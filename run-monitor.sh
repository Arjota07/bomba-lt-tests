#!/usr/bin/env bash
# bomba.lt E2E Production Monitor — local Mac launchd cron
#
# Paleidžia smoke + security + a11y testus prieš https://bomba.lt
# Rezultatai saugomi Dropbox/BOMBA.LT/e2e-monitor-results/YYYYMMDD_HHMMSS/
# Pranešimas (macOS notification) jei aptinka drift'ą.
#
# Manual:    bash ~/Projektai/bomba.lt-tests/run-monitor.sh
# Scheduled: launchctl load ~/Library/LaunchAgents/lt.bomba.e2e-monitor.plist

set -u

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SELF_DIR" || exit 99

# Source nvm (launchd nepasibrarima ~/.zshrc / ~/.bash_profile)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null
export PATH="$NVM_DIR/versions/node/v24.15.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

TS=$(date +%Y%m%d_%H%M%S)

# 🔴 2026-07-30: Dropbox pertvarkytas — BOMBA.LT persikėlė į 02_PROJEKTAI/.
# Senas kelias su `mkdir -p` TYLIAI atkurdavo tuščią aplanką Dropbox šaknyje ir
# rezultatai kaupdavosi kišenėje, kurios niekas nemato. Todėl: auto-detect + fail-loud.
DBX="$HOME/Library/CloudStorage/Dropbox"
DROPBOX_BASE=""
for CAND in "$DBX/02_PROJEKTAI/BOMBA.LT" "$DBX/BOMBA.LT"; do
  [ -d "$CAND" ] && { DROPBOX_BASE="$CAND/e2e-monitor-results"; break; }
done
if [ -z "$DROPBOX_BASE" ]; then
  echo "❌ KLAIDA: nerastas BOMBA.LT aplankas (tikrinta: 02_PROJEKTAI/BOMBA.LT, BOMBA.LT)." >&2
  echo "   Dropbox pertvarkytas? Pataisyk kelią run-monitor.sh." >&2
  exit 98
fi
OUT_DIR="$DROPBOX_BASE/$TS"
mkdir -p "$OUT_DIR"

# ---------------------------------------------------------------------------
# Failure fingerprint / dedup (idėja pasiskolinta iš rutvej/DAA,
# app/common/fingerprint.py — MIT): normalizuojam nepastovias detales,
# hash'uojam, ir TĄ PATĮ gedimą per cooldown langą siunčiam el. paštu tik kartą.
# Naujas arba pasikeitęs gedimas — siunčiamas visada, nepaisant cooldown'o.
# State failas guli Dropbox šaknyje (ne per-run kataloge), kad išgyventų
# 30-dienų cleanup'ą (jis trina tik `-type d`) ir repo perklonavimą.
#   E2E_DEDUP_COOLDOWN_H=<val>  — cooldown valandomis (default 168 = 7 d.)
#   E2E_NO_DEDUP=1              — priverstinai siųsti (dedup apeinamas)
# ---------------------------------------------------------------------------
DEDUP_STATE="$DROPBOX_BASE/.failure-fingerprint"
DEDUP_COOLDOWN_H="${E2E_DEDUP_COOLDOWN_H:-168}"

sha256_16() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | cut -c1-16
  else
    sha256sum | cut -c1-16
  fi
}

# Ištraukia normalizuotus test-level gedimų pavadinimus iš Playwright `line`
# reporter'io log'o. Nupjaunam: ANSI spalvas, "  3) " numeraciją, dekoratyvinį
# ─── padą ir `:eilutė:stulpelis` (kad spec'o redagavimas nepakeistų atspaudo).
suite_failures() {
  grep -E '^[[:space:]]*[0-9]+\) ' "$1" 2>/dev/null \
    | sed -e $'s/\033\[[0-9;]*m//g' \
          -e 's/^[[:space:]]*[0-9][0-9]*)[[:space:]]*//' \
    | while IFS= read -r L; do printf '%s\n' "${L%%─*}"; done \
    | sed -e 's/:[0-9][0-9]*:[0-9][0-9]*//g' \
          -e 's/[[:space:]]*$//' \
    | sort -u
}

LOG="$OUT_DIR/run.log"
exec > >(tee -a "$LOG") 2>&1

echo "=========================================="
echo "bomba.lt E2E Monitor  —  $(date)"
echo "Host: $(hostname)"
echo "Node: $(node --version 2>/dev/null || echo NOT_FOUND)"
echo "Output: $OUT_DIR"
echo "=========================================="

# 🔴 2026-05-26 cutover: bomba.lt → 301 → www.imuzika.lt (kanoninis domenas, tas pats PS9).
# Senasis pre-flight reikalavo grynų 200 iš bomba.lt ir nuo cutover'io NUTRAUKDAVO
# monitorių kas paleidimą (exit 1) — E2E testai nebuvo vykdomi ~2 mėn.
# Dabar: taikinys = kanoninis domenas; `-L` seka redirect'ą, todėl 301 nebėra gedimas.
TARGET="${BASE_URL:-https://www.imuzika.lt}"
export BASE_URL="$TARGET"

HTTP=$(curl -sSL -o /dev/null -w "%{http_code}" --max-time 15 "$TARGET/" 2>&1)
echo "Pre-flight ($TARGET): HTTP $HTTP"
if [ "$HTTP" != "200" ]; then
  echo "❌ $TARGET nepriene (HTTP $HTTP) — pranešu, nutraukiu monitorius"
  osascript -e "display notification \"$TARGET nepasiekiama (HTTP $HTTP)\" with title \"iMuzika E2E MONITOR\" sound name \"Sosumi\"" 2>/dev/null || true
  exit 1
fi

# Papildomai: ar senasis bomba.lt vis dar teisingai redirectina (nekritinė patikra)
REDIR=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 https://bomba.lt/ 2>&1)
echo "bomba.lt redirect check: HTTP $REDIR (laukiama 301)"

OVERALL=0
EXIT_SMOKE=0
EXIT_SECURITY=0
EXIT_A11Y=0
EXIT_PERFORMANCE=0
EXIT_CHECKOUT=0
EXIT_MOBILE=0
EXIT_VISUAL=0

# Suite -> project mapping (bash 3.2 — indexed array, "suite:project" tuples)
# Visual paleidziamas paskutinis — flaky'iausias (font rendering, carousel timing).
SUITES=(
  "smoke:desktop-chromium"
  "security:desktop-chromium"
  "a11y:desktop-chromium"
  "performance:desktop-chromium"
  "checkout:desktop-chromium"
  "mobile:mobile-iphone"
  "visual:desktop-chromium"
)

for ENTRY in "${SUITES[@]}"; do
  SUITE="${ENTRY%%:*}"
  PROJECT="${ENTRY##*:}"
  echo
  echo "--- Running: $SUITE ($PROJECT) ---"
  SUITE_LOG="$OUT_DIR/${SUITE}.log"
  set +e
  # 🔴 2026-07-31: buvo tik --reporter=line, tad HTML report NEgeneruodavo išvis —
  # gale kopijuota `playwright-report/` būdavo pasenusi liekana nuo rankinių paleidimų.
  # Dabar: line (į log'ą) + html; kiekviena suite'ė → savo html-report/<suite>/.
  # PW_TEST_HTML_REPORT_OPEN=never — kad launchd fone neatidarinėtų naršyklės.
  rm -rf playwright-report
  PW_TEST_HTML_REPORT_OPEN=never npx playwright test "tests/e2e/specs/$SUITE" --project="$PROJECT" --reporter=line,html > "$SUITE_LOG" 2>&1
  RC=$?
  set -e 2>/dev/null || true
  if [ -d "playwright-report" ]; then
    mkdir -p "$OUT_DIR/html-report"
    mv playwright-report "$OUT_DIR/html-report/$SUITE" 2>/dev/null || true
  fi
  case "$SUITE" in
    smoke)       EXIT_SMOKE=$RC ;;
    security)    EXIT_SECURITY=$RC ;;
    a11y)        EXIT_A11Y=$RC ;;
    performance) EXIT_PERFORMANCE=$RC ;;
    checkout)    EXIT_CHECKOUT=$RC ;;
    mobile)      EXIT_MOBILE=$RC ;;
    visual)      EXIT_VISUAL=$RC ;;
  esac
  echo "  Exit: $RC"
  tail -5 "$SUITE_LOG" | sed 's/^/  /'
  if [ "$RC" -ne 0 ]; then OVERALL=1; fi
done

# HTML report (paskutinis suite'o run'as palieka — geriau nei nieko)
if [ -d "playwright-report" ]; then
  cp -R playwright-report "$OUT_DIR/html-report" 2>/dev/null || true
fi

# Summary
echo
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
{
  echo "Run:    $TS"
  echo "Date:   $(date)"
  echo "Target: $TARGET"
  echo "Mode:   PROD READ-ONLY"
  echo ""
  for ENTRY in \
    "smoke:$EXIT_SMOKE" \
    "security:$EXIT_SECURITY" \
    "a11y:$EXIT_A11Y" \
    "performance:$EXIT_PERFORMANCE" \
    "checkout:$EXIT_CHECKOUT" \
    "mobile:$EXIT_MOBILE" \
    "visual:$EXIT_VISUAL"; do
    SUITE_NAME="${ENTRY%%:*}"
    RC_VAL="${ENTRY##*:}"
    STATUS="PASS"
    [ "$RC_VAL" -ne 0 ] && STATUS="FAIL"
    printf "  %-12s %s (exit=%d)\n" "$SUITE_NAME" "$STATUS" "$RC_VAL"
  done
  echo ""
  echo "Overall: $([ $OVERALL -eq 0 ] && echo PASS || echo FAIL)"
} | tee "$OUT_DIR/summary.txt"

# Notify ant failures
if [ "$OVERALL" -ne 0 ]; then
  FAIL_LIST=""
  [ "$EXIT_SMOKE" -ne 0 ]       && FAIL_LIST="$FAIL_LIST smoke"
  [ "$EXIT_SECURITY" -ne 0 ]    && FAIL_LIST="$FAIL_LIST security"
  [ "$EXIT_A11Y" -ne 0 ]        && FAIL_LIST="$FAIL_LIST a11y"
  [ "$EXIT_PERFORMANCE" -ne 0 ] && FAIL_LIST="$FAIL_LIST performance"
  [ "$EXIT_CHECKOUT" -ne 0 ]    && FAIL_LIST="$FAIL_LIST checkout"
  [ "$EXIT_MOBILE" -ne 0 ]      && FAIL_LIST="$FAIL_LIST mobile"
  [ "$EXIT_VISUAL" -ne 0 ]      && FAIL_LIST="$FAIL_LIST visual"

  # macOS notification (instant, dingsta jei Mac off) — dedup'as jos NELIEČIA:
  # lokalus toast'as nekaupia inbox'o, o vizualus signalas kas paleidimą naudingas.
  osascript -e "display notification \"FAIL:$FAIL_LIST -- zr. Dropbox/02_PROJEKTAI/BOMBA.LT/e2e-monitor-results/$TS\" with title \"bomba.lt DRIFT DETECTED\" sound name \"Sosumi\"" 2>/dev/null || true
  echo "Notification sent."

  # --- Gedimo pirštų atspaudas + cooldown sprendimas ------------------------
  SIG_RAW=$(
    for SUITE in smoke security a11y performance checkout mobile visual; do
      eval "RC=\$EXIT_$(echo $SUITE | tr a-z A-Z)"
      [ "${RC:-0}" -eq 0 ] && continue
      DETAIL=$(suite_failures "$OUT_DIR/${SUITE}.log")
      if [ -n "$DETAIL" ]; then
        printf '%s\n' "$DETAIL" | sed "s|^|$SUITE\||"
      else
        # crash / timeout / config error — test-level eilučių log'e nėra
        echo "$SUITE|<no-test-detail> exit=$RC"
      fi
    done
  )
  FINGERPRINT=$(printf '%s\n' "$SIG_RAW" | sha256_16)

  PREV_FP=""
  PREV_EPOCH=0
  if [ -f "$DEDUP_STATE" ]; then
    read -r PREV_FP PREV_EPOCH _ < "$DEDUP_STATE" 2>/dev/null || true
  fi
  case "${PREV_EPOCH:-}" in
    ''|*[!0-9]*) PREV_EPOCH=0 ;;
  esac
  NOW_EPOCH=$(date +%s)
  AGE_H=$(( (NOW_EPOCH - PREV_EPOCH) / 3600 ))

  SEND_EMAIL=1
  DEDUP_REASON="naujas gedimo atspaudas ($FINGERPRINT)"
  if [ -n "$PREV_FP" ] && [ "$FINGERPRINT" = "$PREV_FP" ]; then
    if [ "$AGE_H" -lt "$DEDUP_COOLDOWN_H" ]; then
      SEND_EMAIL=0
      DEDUP_REASON="tas pats gedimas ($FINGERPRINT), praejo ${AGE_H}h < ${DEDUP_COOLDOWN_H}h cooldown"
    else
      DEDUP_REASON="tas pats gedimas ($FINGERPRINT), cooldown baigesi (${AGE_H}h >= ${DEDUP_COOLDOWN_H}h)"
    fi
  fi
  if [ "${E2E_NO_DEDUP:-0}" = "1" ]; then
    SEND_EMAIL=1
    DEDUP_REASON="dedup apeitas (E2E_NO_DEDUP=1), atspaudas $FINGERPRINT"
  fi
  echo "Dedup: $DEDUP_REASON"
  {
    echo ""
    echo "Fingerprint: $FINGERPRINT"
    echo "Dedup:       $DEDUP_REASON"
    echo "Signature:"
    printf '%s\n' "$SIG_RAW" | sed 's/^/  /'
  } >> "$OUT_DIR/summary.txt"

  # Email notification (persistent, gauni net jei Mac off-hours)
  EMAIL_BODY=$({
    echo "iMuzika E2E monitor APTIKO DRIFT'A ($TARGET)"
    echo ""
    echo "Run:    $TS"
    echo "Date:   $(date)"
    echo "Target: $TARGET"
    echo ""
    echo "Failed suites:$FAIL_LIST"
    echo "Fingerprint:  $FINGERPRINT  ($DEDUP_REASON)"
    echo ""
    echo "Suite results:"
    for ENTRY in \
      "smoke:$EXIT_SMOKE" \
      "security:$EXIT_SECURITY" \
      "a11y:$EXIT_A11Y" \
      "performance:$EXIT_PERFORMANCE" \
      "checkout:$EXIT_CHECKOUT" \
      "mobile:$EXIT_MOBILE" \
      "visual:$EXIT_VISUAL"; do
      SUITE_NAME="${ENTRY%%:*}"
      RC_VAL="${ENTRY##*:}"
      STATUS="PASS"
      [ "$RC_VAL" -ne 0 ] && STATUS="FAIL"
      echo "  - $SUITE_NAME: $STATUS (exit=$RC_VAL)"
    done
    echo ""
    echo "Details (failed suite logs):"
    for SUITE in smoke security a11y performance checkout mobile visual; do
      eval "RC=\$EXIT_$(echo $SUITE | tr a-z A-Z)"
      if [ "${RC:-0}" -ne 0 ] && [ -f "$OUT_DIR/${SUITE}.log" ]; then
        echo ""
        echo "=== $SUITE.log (last 30 lines) ==="
        tail -30 "$OUT_DIR/${SUITE}.log"
      fi
    done
    echo ""
    echo "Full logs: $OUT_DIR"
    echo "HTML report: $OUT_DIR/html-report/index.html"
  } 2>&1)

  # 🔴 2026-07-31: rankiniam paleidimui — `E2E_NO_EMAIL=1 bash run-monitor.sh`.
  # Anksčiau BET KOKS rankinis paleidimas iškart siųsdavo DRIFT laišką gavėjui
  # (07-30 taip išėjo netyčia). launchd cron'e kintamojo nėra → laiškas siunčiamas kaip anksčiau.
  if [ "${E2E_NO_EMAIL:-0}" = "1" ]; then
    echo "Email PRALEISTAS (E2E_NO_EMAIL=1). Laiško turinys būtų:"
    echo "$EMAIL_BODY" | head -20
  elif [ "$SEND_EMAIL" -eq 0 ]; then
    # Dedup nutildė: tas pats gedimas jau praneštas, cooldown dar nepasibaigęs.
    # State'o NEATNAUJINAM — langas skaičiuojamas nuo PASKUTINIO išsiųsto laiško,
    # kitaip nuolat krentantis suite'as atnaujintų laikrodį ir laiškas
    # nebeateitų niekada.
    echo "Email PRALEISTAS (dedup): $DEDUP_REASON"
  else
    "$SELF_DIR/send-email.sh" "sarmaitis@gmail.com" "[imuzika.lt] DRIFT$FAIL_LIST — $TS" "$EMAIL_BODY" 2>&1 | tail -3
    echo "Email sent to sarmaitis@gmail.com"
    printf '%s %s %s\n' "$FINGERPRINT" "$NOW_EPOCH" "$TS" > "$DEDUP_STATE" 2>/dev/null || \
      echo "⚠️  Nepavyko įrašyti dedup state ($DEDUP_STATE) — kitas run'as siųs pakartotinai." >&2
  fi
else
  # Viskas žalia — pamirštam ankstesnį atspaudą, kad po atsistatymo tas pats
  # gedimas vėl būtų traktuojamas kaip NAUJAS ir praneštas nedelsiant.
  if [ -f "$DEDUP_STATE" ]; then
    rm -f "$DEDUP_STATE" 2>/dev/null || true
    echo "Dedup: viskas PASS — state išvalytas."
  fi
fi

# Cleanup old results (laikyti 30 d.)
find "$DROPBOX_BASE" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \; 2>/dev/null || true

echo
echo "Done. Exit code: $OVERALL"
exit $OVERALL
