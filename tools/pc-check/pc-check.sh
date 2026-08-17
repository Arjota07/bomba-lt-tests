#!/usr/bin/env bash
#
# pc-check.sh — parduotuvės kompiuterių sveikatos patikra (macOS / Linux)
#
# TIK SKAITYMAS. Skriptas nieko nekeičia, netaiso, nediegia, neišjungia ir
# niekur nesiunčia. Visos komandos yra užklausos; vienintelis rašomas failas —
# ataskaita, kurią pats nurodai per --out.
#
# Naudojimas:
#   bash pc-check.sh                      # greita patikra (~15-25 s)
#   bash pc-check.sh --updates            # + OS atnaujinimų paieška (+30-60 s, tinklas)
#   bash pc-check.sh --out ~/report.txt   # ataskaitos vieta
#
# Verdiktai: [OK] tvarkoje · [WARN] verta sutvarkyti · [FAIL] reikia dabar
#            [INFO] tik duomenys · [SKIP] patikra neįmanoma šioje mašinoje
#
# Windows atitikmuo — pc-check.ps1 tame pačiame kataloge.

set -uo pipefail

WANT_UPDATES=0
OUT=""
SHOP_URL="${SHOP_URL:-https://www.imuzika.lt}"

while [ $# -gt 0 ]; do
  case "$1" in
    --updates) WANT_UPDATES=1 ;;
    --out)     shift; OUT="${1:-}" ;;
    -h|--help) sed -n '3,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'Nežinomas argumentas: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

OS="$(uname -s)"
HOST="$(hostname -s 2>/dev/null || echo unknown)"
[ -n "$OUT" ] || OUT="${HOME}/pc-check-${HOST}-$(date +%Y%m%d-%H%M).txt"

WARNS=0
FAILS=0

ok()   { printf '[OK]   %s\n' "$*"; }
warn() { WARNS=$((WARNS + 1)); printf '[WARN] %s\n' "$*"; }
fail() { FAILS=$((FAILS + 1)); printf '[FAIL] %s\n' "$*"; }
info() { printf '[INFO] %s\n' "$*"; }
skip() { printf '[SKIP] %s\n' "$*"; }
sect() { printf '\n== %s ==\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# Sekundes -> "Xd Yh" žmogui.
human_age() {
  local s="$1"
  printf '%dd %dh' $((s / 86400)) $(((s % 86400) / 3600))
}

# ---------------------------------------------------------------- identity ---
check_identity() {
  sect "Mašina"
  info "Vardas:      $HOST"
  info "Data (vietos): $(date '+%Y-%m-%d %H:%M:%S %Z')"

  if [ "$OS" = "Darwin" ]; then
    info "OS:          macOS $(sw_vers -productVersion 2>/dev/null) ($(sw_vers -buildVersion 2>/dev/null))"
    info "Modelis:     $(sysctl -n hw.model 2>/dev/null || echo '?')"
    local serial
    serial="$(ioreg -rd1 -c IOPlatformExpertDevice 2>/dev/null |
      awk -F'"' '/IOPlatformSerialNumber/ {print $4; exit}')"
    info "Serial:      ${serial:-?}"
    info "CPU:         $(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo '?')"
    info "Branduoliai: $(sysctl -n hw.ncpu 2>/dev/null || echo '?')"
  else
    local pretty
    pretty="$( ( . /etc/os-release 2>/dev/null && printf '%s' "${PRETTY_NAME:-}" ) || true )"
    info "OS:          ${pretty:-$(uname -sr)}"
    info "Kernel:      $(uname -r)"
    [ -r /sys/class/dmi/id/product_name ] &&
      info "Modelis:     $(cat /sys/class/dmi/id/product_name 2>/dev/null)"
    info "Branduoliai: $(nproc 2>/dev/null || echo '?')"
  fi
}

# ------------------------------------------------------------------ uptime ---
check_uptime() {
  sect "Veikimo laikas"
  local boot now age
  if [ "$OS" = "Darwin" ]; then
    boot="$(sysctl -n kern.boottime 2>/dev/null | sed -n 's/.*sec = \([0-9]*\).*/\1/p')"
  else
    now="$(date +%s)"
    boot="$(awk -v n="$now" '{printf "%d", n - $1}' /proc/uptime 2>/dev/null)"
  fi
  now="$(date +%s)"
  [ -n "${boot:-}" ] || { skip "Veikimo laiko nustatyti nepavyko"; return; }
  age=$((now - boot))

  if [ "$age" -gt 2592000 ]; then
    warn "Neperkrauta $(human_age "$age") — po >30 d. kaupiasi nutekėjimai ir neįsigalioja atnaujinimai"
  elif [ "$age" -gt 604800 ]; then
    info "Neperkrauta $(human_age "$age")"
  else
    ok "Neperkrauta $(human_age "$age")"
  fi
}

# ------------------------------------------------------------------ memory ---
check_memory() {
  sect "Atmintis"
  if [ "$OS" = "Darwin" ]; then
    local bytes gb swap used
    bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
    gb=$((bytes / 1024 / 1024 / 1024))
    info "RAM iš viso: ${gb} GB"
    [ "$gb" -lt 8 ] && warn "Tik ${gb} GB RAM — šiuolaikinei naršyklei + POS to mažai"

    swap="$(sysctl -n vm.swapusage 2>/dev/null || echo '')"
    if [ -n "$swap" ]; then
      used="$(printf '%s' "$swap" | sed -n 's/.*used = \([0-9.]*\)M.*/\1/p')"
      used="${used%%.*}"
      if [ -n "$used" ] && [ "$used" -gt 4096 ]; then
        warn "Swap naudojama ${used} MB — RAM nebeužtenka, mašina lėtėja"
      elif [ -n "$used" ] && [ "$used" -gt 1024 ]; then
        info "Swap naudojama ${used} MB"
      else
        ok "Swap naudojama ${used:-0} MB"
      fi
    fi
  else
    have free || { skip "free(1) nerastas"; return; }
    local total avail pct
    total="$(free -m | awk '/^Mem:/{print $2}')"
    avail="$(free -m | awk '/^Mem:/{print $7}')"
    info "RAM iš viso: ${total} MB, laisva ${avail} MB"
    if [ -n "$total" ] && [ "$total" -gt 0 ]; then
      pct=$((avail * 100 / total))
      if [ "$pct" -lt 10 ]; then
        warn "Laisva tik ${pct}% RAM"
      else
        ok "Laisva ${pct}% RAM"
      fi
    fi
  fi
}

# -------------------------------------------------------------------- disk ---
check_disk() {
  sect "Diskas — laisva vieta"
  local line dev availkb cap mnt free_h
  while IFS= read -r line; do
    dev="$(printf '%s' "$line" | awk '{print $1}')"
    availkb="$(printf '%s' "$line" | awk '{print $2}')"
    cap="$(printf '%s' "$line" | awk '{print $3}' | tr -d '%')"
    mnt="$(printf '%s' "$line" | awk '{print $4}')"
    # Vienetai pagal mastą: po 1 GB „0 GB" nieko nepasako.
    free_h="$(awk -v k="$availkb" 'BEGIN {
      if (k >= 10485760)    printf "%d GB", k / 1048576
      else if (k >= 1048576) printf "%.1f GB", k / 1048576
      else                   printf "%d MB", k / 1024
    }')"

    case "$mnt" in
      /System/Volumes/VM|/System/Volumes/Preboot|/System/Volumes/Update|\
      /System/Volumes/xarts|/System/Volumes/iSCPreboot|/System/Volumes/Hardware) continue ;;
    esac

    if [ -z "$cap" ]; then
      continue
    elif [ "$cap" -ge 90 ]; then
      fail "${mnt} užimta ${cap}% (laisva ${free_h}, ${dev}) — <10% vietos griaudina atnaujinimus ir DB"
    elif [ "$cap" -ge 80 ]; then
      warn "${mnt} užimta ${cap}% (laisva ${free_h}, ${dev})"
    else
      ok "${mnt} užimta ${cap}% (laisva ${free_h})"
    fi
  done <<EOF
$(df -Pk 2>/dev/null | awk 'NR > 1 && $1 ~ /^\/dev\// {print $1, $4, $5, $6}')
EOF
}

check_smart() {
  sect "Diskas — SMART sveikata"
  if [ "$OS" = "Darwin" ]; then
    local out bad
    out="$(diskutil info -all 2>/dev/null | awk -F': *' '/SMART Status/ {print $2}' | sort -u)"
    [ -n "$out" ] || { skip "SMART duomenų negauta"; return; }
    bad="$(printf '%s\n' "$out" | grep -viE 'verified|not supported' || true)"
    if [ -n "$bad" ]; then
      fail "SMART būsena: $(printf '%s' "$bad" | tr '\n' ' ') — diskas miršta, nedelsiant kopijuok duomenis"
    else
      ok "SMART: $(printf '%s' "$out" | tr '\n' ' ')"
    fi
  elif have smartctl; then
    local d st
    for d in /dev/sd? /dev/nvme?n1; do
      [ -e "$d" ] || continue
      st="$(smartctl -H "$d" 2>/dev/null | awk -F': *' '/overall-health|SMART Health Status/ {print $2; exit}')"
      if [ -z "$st" ]; then
        skip "$d — SMART neprieinamas (reikia root)"
      elif printf '%s' "$st" | grep -qiE 'passed|ok'; then
        ok "$d SMART: $st"
      else
        fail "$d SMART: $st — diskas miršta"
      fi
    done
  else
    skip "smartctl nerastas (Linux: apt install smartmontools)"
  fi
}

# ---------------------------------------------------------------- security ---
check_encryption() {
  sect "Disko šifravimas"
  if [ "$OS" = "Darwin" ]; then
    local st
    st="$(fdesetup status 2>/dev/null || echo '')"
    if printf '%s' "$st" | grep -qi 'FileVault is On'; then
      ok "FileVault įjungtas"
    elif printf '%s' "$st" | grep -qi 'FileVault is Off'; then
      warn "FileVault IŠJUNGTAS — pavogus mašiną klientų duomenys atviri (BDAR rizika)"
    else
      skip "FileVault būsenos nustatyti nepavyko"
    fi
  elif have lsblk; then
    if lsblk -o FSTYPE 2>/dev/null | grep -qi crypto_LUKS; then
      ok "LUKS šifruotas tomas rastas"
    else
      warn "Šifruotų tomų nerasta"
    fi
  else
    skip "Šifravimo patikra neįmanoma"
  fi
}

check_firewall() {
  sect "Ugniasienė"
  if [ "$OS" = "Darwin" ]; then
    local st fw
    fw=/usr/libexec/ApplicationFirewall/socketfilterfw
    if [ -x "$fw" ]; then
      st="$("$fw" --getglobalstate 2>/dev/null || echo '')"
      if printf '%s' "$st" | grep -qi 'enabled'; then
        ok "macOS ugniasienė įjungta"
        return
      elif printf '%s' "$st" | grep -qi 'disabled'; then
        warn "macOS ugniasienė išjungta"
        return
      fi
    fi
    st="$(defaults read /Library/Preferences/com.apple.alf globalstate 2>/dev/null || echo '')"
    case "$st" in
      1 | 2) ok "macOS ugniasienė įjungta (globalstate=$st)" ;;
      0)     warn "macOS ugniasienė išjungta" ;;
      *)     skip "Ugniasienės būsenos nustatyti nepavyko" ;;
    esac
  elif have ufw && ufw status 2>/dev/null | grep -qi 'Status: active'; then
    ok "ufw aktyvi"
  elif have firewall-cmd && [ "$(firewall-cmd --state 2>/dev/null)" = "running" ]; then
    ok "firewalld veikia"
  else
    warn "Aktyvios ugniasienės nerasta"
  fi
}

# ---------------------------------------------------------------- laikas -----
# POS ir buhalterijai laikas kritinis: nuklydęs laikrodis gadina kvitų
# chronologiją, TLS rankos paspaudimus ir banko sutikrinimus.
check_clock() {
  sect "Sistemos laikas"
  have curl || { skip "curl nerastas — laiko sutikrinti negalima"; return; }

  local remote local_epoch remote_epoch diff
  remote="$(curl -sI --max-time 8 https://www.google.com 2>/dev/null |
    awk -F': ' 'tolower($1) == "date" {print $2}' | tr -d '\r' | head -1)"
  [ -n "$remote" ] || { skip "Tinklo laiko negauta (nėra interneto?)"; return; }

  local_epoch="$(date +%s)"
  if [ "$OS" = "Darwin" ]; then
    remote_epoch="$(date -j -u -f '%a, %d %b %Y %H:%M:%S GMT' "$remote" +%s 2>/dev/null || echo '')"
  else
    remote_epoch="$(date -d "$remote" +%s 2>/dev/null || echo '')"
  fi
  [ -n "$remote_epoch" ] || { skip "Tinklo laiko formato nepavyko perskaityti"; return; }

  diff=$((local_epoch - remote_epoch))
  [ "$diff" -lt 0 ] && diff=$((-diff))

  if [ "$diff" -gt 300 ]; then
    fail "Laikrodis nuklydęs ${diff} s — gadina kvitų chronologiją ir TLS"
  elif [ "$diff" -gt 60 ]; then
    warn "Laikrodis nuklydęs ${diff} s"
  else
    ok "Laikrodis sutampa su tinklu (skirtumas ${diff} s)"
  fi
}

# --------------------------------------------------------------- baterija ----
check_battery() {
  sect "Baterija"
  if [ "$OS" != "Darwin" ]; then
    if [ -r /sys/class/power_supply/BAT0/capacity ]; then
      info "Įkrova: $(cat /sys/class/power_supply/BAT0/capacity)%"
    else
      skip "Baterijos nėra (stacionarus) arba duomenys neprieinami"
    fi
    return
  fi

  local batt cond cycles
  batt="$(pmset -g batt 2>/dev/null | sed -n '2p' | sed 's/^[[:space:]]*//')"
  if [ -z "$batt" ]; then
    skip "Baterijos nėra (stacionarus Mac)"
    return
  fi
  info "Būsena: $batt"

  cond="$(system_profiler SPPowerDataType 2>/dev/null |
    awk -F': *' '/Condition/ {print $2; exit}')"
  cycles="$(system_profiler SPPowerDataType 2>/dev/null |
    awk -F': *' '/Cycle Count/ {print $2; exit}')"
  [ -n "$cycles" ] && info "Ciklai: $cycles"

  case "${cond:-}" in
    Normal) ok "Baterijos būklė: Normal" ;;
    "")     skip "Baterijos būklės negauta" ;;
    *)      warn "Baterijos būklė: $cond — planuok keitimą" ;;
  esac
}

# ------------------------------------------------------------ atsarginės -----
check_backups() {
  sect "Atsarginės kopijos"
  if [ "$OS" != "Darwin" ]; then
    skip "Automatinė patikra tik macOS (Linux — tikrink savo sprendimą rankomis)"
    return
  fi

  have tmutil || { skip "tmutil nerastas"; return; }

  local dest latest ts age
  dest="$(tmutil destinationinfo 2>/dev/null || echo '')"
  if [ -z "$dest" ] || printf '%s' "$dest" | grep -qi 'no destinations'; then
    warn "Time Machine paskirties vieta nenustatyta — kopijų NĖRA"
    return
  fi

  latest="$(tmutil latestbackup 2>/dev/null || echo '')"
  if [ -z "$latest" ]; then
    warn "Time Machine sukonfigūruota, bet nė vienos kopijos nerasta (arba nėra Full Disk Access)"
    return
  fi

  # Kopijos katalogas: .../YYYY-MM-DD-HHMMSS
  ts="$(basename "$latest" | sed -n 's/^\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\)-\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\).*/\1 \2:\3:\4/p')"
  if [ -z "$ts" ]; then
    info "Paskutinė kopija: $latest"
    return
  fi

  age=$(( $(date +%s) - $(date -j -f '%Y-%m-%d %H:%M:%S' "$ts" +%s 2>/dev/null || date +%s) ))
  if [ "$age" -gt 604800 ]; then
    fail "Paskutinė kopija prieš $(human_age "$age") ($ts) — kopijos sustojo"
  elif [ "$age" -gt 172800 ]; then
    warn "Paskutinė kopija prieš $(human_age "$age") ($ts)"
  else
    ok "Paskutinė kopija prieš $(human_age "$age") ($ts)"
  fi
}

# ------------------------------------------------------------- avarijos ------
check_crashes() {
  sect "Avarijos (30 d.)"
  if [ "$OS" != "Darwin" ]; then
    if have journalctl; then
      local n
      n="$(journalctl --since '30 days ago' -p err --no-pager 2>/dev/null | wc -l | tr -d ' ')"
      [ "${n:-0}" -gt 500 ] && warn "journald: ${n} klaidų per 30 d." || info "journald: ${n:-0} klaidų per 30 d."
    else
      skip "journalctl nerastas"
    fi
    return
  fi

  local n
  n="$(find /Library/Logs/DiagnosticReports -name '*.panic' -mtime -30 2>/dev/null | wc -l | tr -d ' ')"
  if [ "${n:-0}" -gt 0 ]; then
    warn "Kernel panic'ų per 30 d.: ${n} — dažniausiai RAM, diskas ar tvarkyklė"
  else
    ok "Kernel panic'ų per 30 d. nėra"
  fi
}

# ------------------------------------------------------------ procesai -------
check_top() {
  sect "Daugiausiai CPU naudojantys procesai"
  if [ "$OS" = "Darwin" ]; then
    ps -Ao pcpu,rss,comm -r 2>/dev/null | head -6 |
      awk 'NR > 1 {printf "[INFO] %5.1f%% CPU, %6d MB  %s\n", $1, $2 / 1024, $3}'
  else
    ps -eo pcpu,rss,comm --sort=-pcpu 2>/dev/null | head -6 |
      awk 'NR > 1 {printf "[INFO] %5.1f%% CPU, %6d MB  %s\n", $1, $2 / 1024, $3}'
  fi
}

# -------------------------------------------------------------- tinklas ------
check_network() {
  sect "Tinklas"
  local gw iface ip dns code total

  if [ "$OS" = "Darwin" ]; then
    gw="$(route -n get default 2>/dev/null | awk '/gateway/ {print $2; exit}')"
    iface="$(route -n get default 2>/dev/null | awk '/interface/ {print $2; exit}')"
    [ -n "${iface:-}" ] && ip="$(ipconfig getifaddr "$iface" 2>/dev/null || echo '')"
    dns="$(scutil --dns 2>/dev/null | awk '/nameserver\[0\]/ {print $3; exit}')"
  else
    gw="$(ip route 2>/dev/null | awk '/^default/ {print $3; exit}')"
    iface="$(ip route 2>/dev/null | awk '/^default/ {print $5; exit}')"
    [ -n "${iface:-}" ] && ip="$(ip -4 addr show "$iface" 2>/dev/null |
      awk '/inet /{sub(/\/.*/, "", $2); print $2; exit}')"
    dns="$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf 2>/dev/null)"
  fi

  info "Sąsaja: ${iface:-?}  IP: ${ip:-?}  Šliuzas: ${gw:-?}  DNS: ${dns:-?}"
  [ -n "${ip:-}" ] || warn "Sąsaja be IPv4 adreso"

  have curl || { skip "curl nerastas — pasiekiamumo netikrinu"; return; }

  for url in "https://www.google.com" "$SHOP_URL"; do
    read -r code total <<EOF
$(curl -sS -o /dev/null -w '%{http_code} %{time_total}' --max-time 15 "$url" 2>/dev/null || echo '000 0')
EOF
    if [ "$code" = "000" ]; then
      fail "${url} nepasiekiamas"
    elif [ "$code" -ge 400 ] 2>/dev/null; then
      warn "${url} → HTTP ${code} (${total}s)"
    else
      ok "${url} → HTTP ${code} per ${total}s"
    fi
  done
}

# ------------------------------------------------------------ spausdintuvai --
check_printers() {
  sect "Spausdintuvai"
  have lpstat || { skip "lpstat nerastas"; return; }

  local out
  out="$(lpstat -p 2>/dev/null || echo '')"
  if [ -z "$out" ]; then
    info "Sukonfigūruotų spausdintuvų nėra"
    return
  fi
  printf '%s\n' "$out" | while IFS= read -r line; do
    if printf '%s' "$line" | grep -qi 'disabled'; then
      warn "$line"
    else
      info "$line"
    fi
  done
  info "Numatytasis: $(lpstat -d 2>/dev/null | sed 's/^[^:]*: *//' || echo '?')"
}

# ------------------------------------------------------------- terminis ------
check_thermal() {
  [ "$OS" = "Darwin" ] || return 0
  sect "Terminis droselis"
  local limit
  limit="$(pmset -g therm 2>/dev/null | awk -F'= *' '/CPU_Speed_Limit/ {print $2; exit}')"
  if [ -z "$limit" ]; then
    skip "Terminių duomenų negauta"
  elif [ "$limit" -lt 100 ] 2>/dev/null; then
    warn "CPU apribotas iki ${limit}% — perkaista (išvalyk ventiliatorius / patikrink vietą)"
  else
    ok "CPU neapribotas (100%)"
  fi
}

# ---------------------------------------------------------- atnaujinimai -----
check_updates() {
  sect "OS atnaujinimai"
  if [ "$WANT_UPDATES" -eq 0 ]; then
    skip "Praleista — paleisk su --updates (užima 30-60 s)"
    return
  fi

  if [ "$OS" = "Darwin" ]; then
    local out
    out="$(softwareupdate -l 2>&1 || true)"
    if printf '%s' "$out" | grep -qi 'no new software available'; then
      ok "Atnaujinimų nėra"
    else
      warn "Yra neįdiegtų atnaujinimų:"
      printf '%s\n' "$out" | grep -E '^\s*\*|Label:' | sed 's/^/       /'
    fi
  elif have apt; then
    local n
    n="$(apt list --upgradable 2>/dev/null | grep -c upgradable || true)"
    [ "${n:-0}" -gt 0 ] && warn "apt: ${n} paketų atnaujinimui" || ok "apt: atnaujinimų nėra"
  elif have dnf; then
    dnf check-update >/dev/null 2>&1 && ok "dnf: atnaujinimų nėra" || warn "dnf: yra atnaujinimų"
  else
    skip "Paketų tvarkyklė neatpažinta"
  fi
}

# ----------------------------------------------------------------- main ------
main() {
  printf '===============================================================\n'
  printf ' PC-CHECK — parduotuvės kompiuterio patikra (TIK SKAITYMAS)\n'
  printf ' %s · %s · %s\n' "$HOST" "$OS" "$(date '+%Y-%m-%d %H:%M:%S %Z')"
  printf '===============================================================\n'

  check_identity
  check_uptime
  check_memory
  check_disk
  check_smart
  check_encryption
  check_firewall
  check_clock
  check_battery
  check_backups
  check_crashes
  check_top
  check_network
  check_printers
  check_thermal
  check_updates

  sect "SUVESTINĖ"
  printf 'FAIL: %d   WARN: %d\n' "$FAILS" "$WARNS"
  if [ "$FAILS" -gt 0 ]; then
    printf 'Verdiktas: REIKIA VEIKSMO — žr. [FAIL] įrašus aukščiau.\n'
  elif [ "$WARNS" -gt 0 ]; then
    printf 'Verdiktas: VEIKIA, bet yra ką sutvarkyti — žr. [WARN].\n'
  else
    printf 'Verdiktas: SVEIKA.\n'
  fi
}

main 2>&1 | tee "$OUT"
printf '\nAtaskaita: %s\n' "$OUT"
