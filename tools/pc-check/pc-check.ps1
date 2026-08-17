#Requires -Version 5.1
<#
    pc-check.ps1 — parduotuvės kompiuterių sveikatos patikra (Windows)

    TIK SKAITYMAS. Skriptas nieko nekeičia, netaiso, nediegia, neperkrauna ir
    niekur nesiunčia. Visos komandos yra užklausos; vienintelis rašomas failas —
    ataskaita, kurią pats nurodai per -Out.

    Naudojimas (PowerShell, paprastas naudotojas užtenka):
        powershell -ExecutionPolicy Bypass -File .\pc-check.ps1
        powershell -ExecutionPolicy Bypass -File .\pc-check.ps1 -Updates
        powershell -ExecutionPolicy Bypass -File .\pc-check.ps1 -Out C:\report.txt

    Dalis patikrų (BitLocker, disko patikimumo skaitliukai) be administratoriaus
    teisių grąžina [SKIP] — tai ne klaida. Pilnam vaizdui paleisk PowerShell su
    „Run as administrator".

    Verdiktai: [OK] tvarkoje · [WARN] verta sutvarkyti · [FAIL] reikia dabar
               [INFO] tik duomenys · [SKIP] patikra neįmanoma šioje mašinoje

    macOS / Linux atitikmuo — pc-check.sh tame pačiame kataloge.
#>

[CmdletBinding()]
param(
    [switch] $Updates,
    [string] $Out,
    [string] $ShopUrl = 'https://www.imuzika.lt'
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

$script:Warns = 0
$script:Fails = 0

function Ok   { param([string]$m) Write-Output "[OK]   $m" }
function Info { param([string]$m) Write-Output "[INFO] $m" }
function Skip { param([string]$m) Write-Output "[SKIP] $m" }
function Warn { param([string]$m) $script:Warns++; Write-Output "[WARN] $m" }
function Fail { param([string]$m) $script:Fails++; Write-Output "[FAIL] $m" }
function Sect { param([string]$m) Write-Output ''; Write-Output "== $m ==" }

function Format-Size {
    param([double] $Bytes)
    if ($Bytes -ge 10GB)  { return ('{0:N0} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1GB)   { return ('{0:N1} GB' -f ($Bytes / 1GB)) }
    return ('{0:N0} MB' -f ($Bytes / 1MB))
}

# ------------------------------------------------------------------ mašina ---
function Check-Identity {
    Sect 'Mašina'
    Info "Vardas:        $env:COMPUTERNAME"
    Info "Naudotojas:    $env:USERNAME"
    Info "Data (vietos): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"

    try {
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
        $bi = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
        $cpu = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1

        Info "OS:            $($os.Caption) $($os.Version) ($($os.OSArchitecture))"
        Info "Modelis:       $($cs.Manufacturer) $($cs.Model)"
        if ($bi) { Info "Serial:        $($bi.SerialNumber)" }
        if ($cpu) { Info "CPU:           $($cpu.Name.Trim()) ($($cpu.NumberOfCores) branduoliai)" }
    } catch {
        Skip "Mašinos duomenų negauta: $($_.Exception.Message)"
    }
}

function Check-Uptime {
    Sect 'Veikimo laikas'
    try {
        $boot = (Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).LastBootUpTime
        $age  = (Get-Date) - $boot
        $txt  = '{0}d {1}h' -f [int]$age.TotalDays, $age.Hours

        if ($age.TotalDays -gt 30) {
            Warn "Neperkrauta $txt — po >30 d. neįsigalioja atnaujinimai ir kaupiasi nutekėjimai"
        } elseif ($age.TotalDays -gt 7) {
            Info "Neperkrauta $txt"
        } else {
            Ok "Neperkrauta $txt"
        }
    } catch {
        Skip 'Veikimo laiko nustatyti nepavyko'
    }
}

function Check-PendingReboot {
    Sect 'Laukiantis perkrovimas'
    $keys = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending',
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
    )
    $hit = $keys | Where-Object { Test-Path $_ -ErrorAction SilentlyContinue }
    if ($hit) {
        Warn "Windows laukia perkrovimo ($($hit.Count) žymė) — atnaujinimai neįsigalioję"
    } else {
        Ok 'Laukiančio perkrovimo nėra'
    }
}

# ---------------------------------------------------------------- atmintis ---
function Check-Memory {
    Sect 'Atmintis'
    try {
        $os    = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
        $total = $os.TotalVisibleMemorySize * 1KB
        $free  = $os.FreePhysicalMemory * 1KB
        $pct   = [math]::Round(($free / $total) * 100)

        Info "RAM iš viso: $(Format-Size $total), laisva $(Format-Size $free)"
        if ($total -lt 8GB) { Warn "Tik $(Format-Size $total) RAM — naršyklei + kasos programai to mažai" }

        if ($pct -lt 10) {
            Warn "Laisva tik $pct% RAM — mašina swap'ina ir stringa"
        } else {
            Ok "Laisva $pct% RAM"
        }
    } catch {
        Skip 'Atminties duomenų negauta'
    }
}

# ------------------------------------------------------------------ diskas ---
function Check-Disk {
    Sect 'Diskas — laisva vieta'
    try {
        $vols = Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction Stop
    } catch {
        Skip 'Tomų sąrašo negauta'; return
    }

    foreach ($v in $vols) {
        if (-not $v.Size -or $v.Size -eq 0) { continue }
        $usedPct = [math]::Round((($v.Size - $v.FreeSpace) / $v.Size) * 100)
        $freeTxt = Format-Size $v.FreeSpace

        if ($usedPct -ge 90) {
            Fail "$($v.DeviceID) užimta $usedPct% (laisva $freeTxt) — <10% vietos griaudina atnaujinimus ir DB"
        } elseif ($usedPct -ge 80) {
            Warn "$($v.DeviceID) užimta $usedPct% (laisva $freeTxt)"
        } else {
            Ok "$($v.DeviceID) užimta $usedPct% (laisva $freeTxt)"
        }
    }
}

function Check-DiskHealth {
    Sect 'Diskas — SMART sveikata'
    try {
        $disks = Get-PhysicalDisk -ErrorAction Stop
    } catch {
        Skip 'Get-PhysicalDisk neprieinamas (senas Windows?)'; return
    }

    foreach ($d in $disks) {
        $label = "$($d.FriendlyName) [$($d.MediaType), $(Format-Size $d.Size)]"
        switch ($d.HealthStatus) {
            'Healthy' { Ok "$label — Healthy" }
            'Warning' { Warn "$label — Warning: diskas pradeda kristi, planuok keitimą" }
            default   { Fail "$label — $($d.HealthStatus): nedelsiant kopijuok duomenis" }
        }

        try {
            $rc = $d | Get-StorageReliabilityCounter -ErrorAction Stop
            if ($null -ne $rc.Wear -and $rc.Wear -gt 80) {
                Warn "$($d.FriendlyName): SSD nusidėvėjimas $($rc.Wear)%"
            }
            if ($rc.ReadErrorsTotal -gt 0 -or $rc.WriteErrorsTotal -gt 0) {
                Warn "$($d.FriendlyName): skaitymo klaidų $($rc.ReadErrorsTotal), rašymo $($rc.WriteErrorsTotal)"
            }
        } catch {
            # Patikimumo skaitliukai reikalauja admin teisių — ne klaida.
        }
    }
}

# ---------------------------------------------------------------- saugumas ---
function Check-BitLocker {
    Sect 'Disko šifravimas'
    try {
        $vols = Get-BitLockerVolume -ErrorAction Stop | Where-Object { $_.VolumeType -eq 'OperatingSystem' }
        if (-not $vols) { Skip 'Sistemos tomo BitLocker duomenų negauta'; return }
        foreach ($v in $vols) {
            if ($v.ProtectionStatus -eq 'On') {
                Ok "BitLocker įjungtas ($($v.MountPoint), $($v.EncryptionMethod))"
            } else {
                Warn "BitLocker IŠJUNGTAS ($($v.MountPoint)) — pavogus mašiną klientų duomenys atviri (BDAR rizika)"
            }
        }
    } catch {
        Skip 'BitLocker patikrai reikia administratoriaus teisių'
    }
}

function Check-Antivirus {
    Sect 'Antivirusinė'
    try {
        $mp = Get-MpComputerStatus -ErrorAction Stop
        if ($mp.AntivirusEnabled) { Ok 'Defender: antivirusinė įjungta' }
        else { Warn 'Defender: antivirusinė išjungta' }

        if ($mp.RealTimeProtectionEnabled) { Ok 'Defender: realaus laiko apsauga įjungta' }
        else { Warn 'Defender: realaus laiko apsauga IŠJUNGTA' }

        if ($mp.AntivirusSignatureAge -gt 7) {
            Warn "Defender: parašai $($mp.AntivirusSignatureAge) d. senumo"
        } else {
            Ok "Defender: parašai $($mp.AntivirusSignatureAge) d. senumo"
        }
    } catch {
        Skip 'Defender duomenų negauta (galbūt naudojama trečios šalies AV)'
    }

    try {
        $av = Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName AntiVirusProduct -ErrorAction Stop
        foreach ($p in $av) { Info "Registruota AV: $($p.displayName)" }
    } catch {
        # SecurityCenter2 nėra Windows Server leidimuose — ne klaida.
    }
}

function Check-Firewall {
    Sect 'Ugniasienė'
    try {
        $profiles = Get-NetFirewallProfile -ErrorAction Stop
        foreach ($p in $profiles) {
            if ($p.Enabled) { Ok "Ugniasienė įjungta: $($p.Name)" }
            else { Warn "Ugniasienė IŠJUNGTA: $($p.Name)" }
        }
    } catch {
        Skip 'Ugniasienės būsenos negauta'
    }
}

# ------------------------------------------------------------------ laikas ---
# POS ir buhalterijai laikas kritinis: nuklydęs laikrodis gadina kvitų
# chronologiją, TLS rankos paspaudimus ir banko sutikrinimus.
function Check-Clock {
    Sect 'Sistemos laikas'
    try {
        $status = & w32tm /query /status 2>&1
        $src = ($status | Select-String -Pattern 'Source:' | Select-Object -First 1)
        if ($src) { Info ($src.ToString().Trim()) } else { Info 'w32tm: šaltinis nenurodytas' }
    } catch {
        Skip 'w32tm neprieinamas'
    }

    try {
        $resp = Invoke-WebRequest -Uri 'https://www.google.com' -Method Head -TimeoutSec 10 `
            -UseBasicParsing -ErrorAction Stop
        $hdr = $resp.Headers['Date']
        if (-not $hdr) { Skip 'Tinklo laiko antraštės negauta'; return }

        $remote = $null
        try {
            $remote = [datetime]::ParseExact($hdr, 'ddd, dd MMM yyyy HH:mm:ss \G\M\T',
                [Globalization.CultureInfo]::InvariantCulture,
                [Globalization.DateTimeStyles]::AssumeUniversal)
        } catch {
            $remote = [datetime]$hdr
        }

        $diff = [math]::Abs(((Get-Date).ToUniversalTime() - $remote.ToUniversalTime()).TotalSeconds)
        if ($diff -gt 300) {
            Fail "Laikrodis nuklydęs $([int]$diff) s — gadina kvitų chronologiją ir TLS"
        } elseif ($diff -gt 60) {
            Warn "Laikrodis nuklydęs $([int]$diff) s"
        } else {
            Ok "Laikrodis sutampa su tinklu (skirtumas $([int]$diff) s)"
        }
    } catch {
        Skip 'Tinklo laiko negauta (nėra interneto?)'
    }
}

# -------------------------------------------------------------- baterija -----
function Check-Battery {
    Sect 'Baterija'
    try {
        $b = Get-CimInstance Win32_Battery -ErrorAction Stop | Select-Object -First 1
        if (-not $b) { Skip 'Baterijos nėra (stacionarus)'; return }

        Info "Įkrova: $($b.EstimatedChargeRemaining)%"
        if ($b.EstimatedChargeRemaining -lt 20) { Info 'Žema įkrova (informacinis)' }

        $full   = Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryFullChargedCapacity -ErrorAction Stop |
                  Select-Object -First 1
        $design = Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryStaticData -ErrorAction Stop |
                  Select-Object -First 1
        if ($full.FullChargedCapacity -and $design.DesignedCapacity) {
            $health = [math]::Round(($full.FullChargedCapacity / $design.DesignedCapacity) * 100)
            if ($health -lt 70) {
                Warn "Baterijos talpa $health% nuo projektinės — planuok keitimą"
            } else {
                Ok "Baterijos talpa $health% nuo projektinės"
            }
        }
    } catch {
        Skip 'Baterijos nėra arba WMI duomenų negauta'
    }
}

# ---------------------------------------------------------- atsarginės -------
function Check-Backups {
    Sect 'Atsarginės kopijos'
    try {
        $rp = Get-ComputerRestorePoint -ErrorAction Stop | Sort-Object CreationTime | Select-Object -Last 1
        if ($rp) {
            $age = ((Get-Date) - $rp.ConvertToDateTime($rp.CreationTime)).TotalDays
            Info ('Paskutinis atkūrimo taškas prieš {0:N0} d.' -f $age)
        } else {
            Info 'Atkūrimo taškų nėra'
        }
    } catch {
        Skip 'Atkūrimo taškų duomenų negauta'
    }

    try {
        $fh = Get-ScheduledTask -TaskPath '\Microsoft\Windows\FileHistory\' -ErrorAction Stop
        $on = $fh | Where-Object { $_.State -ne 'Disabled' }
        if ($on) { Ok "File History užduotis aktyvi ($($on.Count))" }
        else { Warn 'File History išjungta' }
    } catch {
        Skip 'File History būsenos negauta'
    }

    # Sąmoningai Info, ne Warn: nuolatinis WARN kiekviename paleidime padarytų
    # suvestinę nebeinformatyvia (verdiktas „SVEIKA" niekada nebūtų įmanomas).
    Info 'Parduotuvės duomenų kopijas (kasos DB, sąskaitos) patikrink RANKOMIS — skriptas jų neaptinka'
}

# ------------------------------------------------------------- žurnalai ------
function Check-EventLog {
    Sect 'Sistemos žurnalo klaidos (7 d.)'
    try {
        $since = (Get-Date).AddDays(-7)
        $ev = Get-WinEvent -FilterHashtable @{
            LogName   = 'System'
            Level     = 1, 2
            StartTime = $since
        } -ErrorAction Stop

        $n = @($ev).Count
        if ($n -eq 0) { Ok 'Kritinių/klaidų įrašų nėra'; return }

        if ($n -gt 100) { Warn "Kritinių/klaidų įrašų: $n — nesveikai daug" }
        else { Info "Kritinių/klaidų įrašų: $n" }

        $ev | Group-Object -Property ProviderName |
            Sort-Object Count -Descending | Select-Object -First 5 |
            ForEach-Object { Info "  $($_.Count)x $($_.Name)" }
    } catch {
        Skip 'Sistemos žurnalo negauta (gali reikėti administratoriaus teisių)'
    }
}

# ------------------------------------------------------------- procesai ------
function Check-Top {
    Sect 'Daugiausiai CPU sunaudoję procesai (nuo starto)'
    try {
        Get-Process -ErrorAction Stop |
            Where-Object { $_.CPU } |
            Sort-Object CPU -Descending | Select-Object -First 5 |
            ForEach-Object {
                Info ('{0,8:N0} s CPU, {1,7} RAM  {2}' -f $_.CPU, (Format-Size $_.WorkingSet64), $_.ProcessName)
            }
    } catch {
        Skip 'Procesų sąrašo negauta'
    }
}

function Check-Startup {
    Sect 'Automatinis startas'
    try {
        $items = @(Get-CimInstance Win32_StartupCommand -ErrorAction Stop)
        if ($items.Count -gt 15) {
            Warn "Autostart programų: $($items.Count) — lėtina įsijungimą"
        } else {
            Ok "Autostart programų: $($items.Count)"
        }
        $items | Select-Object -First 10 | ForEach-Object { Info "  $($_.Name)" }
    } catch {
        Skip 'Autostart sąrašo negauta'
    }
}

# -------------------------------------------------------------- tinklas ------
function Check-Network {
    Sect 'Tinklas'
    try {
        $cfg = Get-NetIPConfiguration -ErrorAction Stop |
            Where-Object { $_.IPv4DefaultGateway } | Select-Object -First 1
        if ($cfg) {
            Info "Sąsaja: $($cfg.InterfaceAlias)"
            Info "IP: $($cfg.IPv4Address.IPAddress)  Šliuzas: $($cfg.IPv4DefaultGateway.NextHop)"
            Info "DNS: $($cfg.DNSServer.ServerAddresses -join ', ')"
        } else {
            Warn 'Sąsajos su numatytuoju šliuzu nėra — mašina be tinklo'
        }
    } catch {
        Skip 'Tinklo konfigūracijos negauta'
    }

    foreach ($url in @('https://www.google.com', $ShopUrl)) {
        try {
            $sw = [Diagnostics.Stopwatch]::StartNew()
            $r = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
            $sw.Stop()
            Ok ('{0} → HTTP {1} per {2:N2}s' -f $url, [int]$r.StatusCode, $sw.Elapsed.TotalSeconds)
        } catch {
            $code = $null
            if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
            if ($code) { Warn "$url → HTTP $code" }
            else { Fail "$url nepasiekiamas: $($_.Exception.Message)" }
        }
    }
}

# --------------------------------------------------------- spausdintuvai -----
function Check-Printers {
    Sect 'Spausdintuvai'
    try {
        $printers = @(Get-Printer -ErrorAction Stop)
        if ($printers.Count -eq 0) { Info 'Sukonfigūruotų spausdintuvų nėra'; return }

        foreach ($p in $printers) {
            $tag = if ($p.Shared) { ' (bendrinamas)' } else { '' }
            $state = [string] $p.PrinterStatus
            if ($state -match 'Offline|Error|Paused') {
                Warn "$($p.Name)$tag — $state"
            } else {
                Info "$($p.Name)$tag — $state"
            }

            # Po vieno spausdintuvo: -PrinterName masyvo nepriima visose versijose.
            $jobs = @(Get-PrintJob -PrinterName $p.Name -ErrorAction SilentlyContinue)
            if ($jobs.Count -gt 5) {
                Warn "$($p.Name): užstrigusių spaudos darbų eilėje $($jobs.Count)"
            }
        }
    } catch {
        Skip 'Spausdintuvų sąrašo negauta'
    }
}

# ------------------------------------------------------- atnaujinimai --------
function Check-Updates {
    Sect 'Windows atnaujinimai'
    if (-not $Updates) {
        Skip 'Praleista — paleisk su -Updates (užima 30-90 s)'
        return
    }

    try {
        $session  = New-Object -ComObject Microsoft.Update.Session
        $searcher = $session.CreateUpdateSearcher()
        $result   = $searcher.Search('IsInstalled=0 and IsHidden=0')
        $n        = $result.Updates.Count

        if ($n -eq 0) {
            Ok 'Neįdiegtų atnaujinimų nėra'
        } else {
            Warn "Neįdiegtų atnaujinimų: $n"
            for ($i = 0; $i -lt [math]::Min($n, 10); $i++) {
                Info "  $($result.Updates.Item($i).Title)"
            }
        }
    } catch {
        Skip "Atnaujinimų paieška nepavyko: $($_.Exception.Message)"
    }

    try {
        $last = Get-HotFix -ErrorAction Stop | Sort-Object InstalledOn | Select-Object -Last 1
        if ($last.InstalledOn) {
            $age = ((Get-Date) - $last.InstalledOn).TotalDays
            if ($age -gt 60) {
                Warn ('Paskutinis pataisas įdiegtas prieš {0:N0} d. ({1})' -f $age, $last.HotFixID)
            } else {
                Ok ('Paskutinis pataisas prieš {0:N0} d. ({1})' -f $age, $last.HotFixID)
            }
        }
    } catch {
        Skip 'Įdiegtų pataisų sąrašo negauta'
    }
}

# ---------------------------------------------------------------- main -------
function Invoke-Main {
    Write-Output '==============================================================='
    Write-Output ' PC-CHECK — parduotuvės kompiuterio patikra (TIK SKAITYMAS)'
    Write-Output " $env:COMPUTERNAME · Windows · $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Output '==============================================================='

    Check-Identity
    Check-Uptime
    Check-PendingReboot
    Check-Memory
    Check-Disk
    Check-DiskHealth
    Check-BitLocker
    Check-Antivirus
    Check-Firewall
    Check-Clock
    Check-Battery
    Check-Backups
    Check-EventLog
    Check-Top
    Check-Startup
    Check-Network
    Check-Printers
    Check-Updates

    Sect 'SUVESTINĖ'
    Write-Output ("FAIL: {0}   WARN: {1}" -f $script:Fails, $script:Warns)
    if ($script:Fails -gt 0) {
        Write-Output 'Verdiktas: REIKIA VEIKSMO — žr. [FAIL] įrašus aukščiau.'
    } elseif ($script:Warns -gt 0) {
        Write-Output 'Verdiktas: VEIKIA, bet yra ką sutvarkyti — žr. [WARN].'
    } else {
        Write-Output 'Verdiktas: SVEIKA.'
    }
}

if (-not $Out) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmm'
    $Out = Join-Path ([Environment]::GetFolderPath('Desktop')) "pc-check-$env:COMPUTERNAME-$stamp.txt"
}

# NB: Tee-Object -Encoding atsirado tik PowerShell 6.0, o parduotuvių mašinose
# beveik visada PS 5.1 → ten toks skambutis nulūžtų „parameter cannot be found".
# Todėl renkam į kintamąjį ir rašom per Out-File, kuris -Encoding turi abiejose.
$report = Invoke-Main
$report | Out-File -FilePath $Out -Encoding UTF8
$report
Write-Output ''
Write-Output "Ataskaita: $Out"
