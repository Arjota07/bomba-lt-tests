# pc-check — parduotuvės kompiuterių patikra

Diagnostika, paleidžiama **ant kiekvienos parduotuvės mašinos**. Grąžina vieną
tekstinę ataskaitą su verdiktais, kurią galima persiųsti peržiūrai.

Su Playwright testais šiame repo nesusiję — tai atskiras įrankis, kaip ir
[`.claude/`](../../.claude/README.md).

## ⚠️ TIK SKAITYMAS

Skriptai **nieko nekeičia**: neišjungia, neperkrauna, netaiso, nediegia, netrina
ir niekur nesiunčia. Visos komandos yra užklausos. Vienintelis rašomas failas —
ataskaita, kurios vietą nurodai pats.

Ką pamatai ataskaitoje — tas ir yra visas skripto veikimas. Sprendimą, ką taisyti,
priimi tu.

## Kuris failas kuriai mašinai

| Mašina | Failas | Paleidimas |
|---|---|---|
| Windows (kasa, biuro PC) | `pc-check.ps1` | `powershell -ExecutionPolicy Bypass -File .\pc-check.ps1` |
| macOS | `pc-check.sh` | `bash pc-check.sh` |
| Linux | `pc-check.sh` | `bash pc-check.sh` |

Greita patikra užima ~15–25 s. OS atnaujinimų paieška lėta (tinklas), todėl ji
atskirai:

```bash
# macOS / Linux
bash pc-check.sh --updates
bash pc-check.sh --out ~/Desktop/kasa-1.txt

# Windows
powershell -ExecutionPolicy Bypass -File .\pc-check.ps1 -Updates
powershell -ExecutionPolicy Bypass -File .\pc-check.ps1 -Out C:\kasa-1.txt
```

Be `--out` / `-Out` ataskaita atsiduria: macOS/Linux — `~/pc-check-<vardas>-<data>.txt`,
Windows — darbalaukyje.

### Administratoriaus teisės

Nereikalingos — skriptas veikia ir su paprastu naudotoju. Bet kelios patikros be
admin grąžina `[SKIP]`, ir tai **ne klaida**:

| Patikra | Be admin |
|---|---|
| BitLocker (Windows) | `[SKIP]` |
| Disko patikimumo skaitliukai (Windows) | tyliai praleidžiama |
| Sistemos žurnalas (Windows) | gali būti `[SKIP]` |
| SMART per `smartctl` (Linux) | `[SKIP]` |
| Time Machine (macOS) | reikia Full Disk Access terminalui |

Pilnam vaizdui: Windows — PowerShell „Run as administrator"; Linux — `sudo`.

## Verdiktai

| Žymė | Reikšmė |
|---|---|
| `[OK]` | Tvarkoje |
| `[WARN]` | Veikia, bet verta sutvarkyti |
| `[FAIL]` | Reikia veiksmo dabar |
| `[INFO]` | Tik duomenys, be vertinimo |
| `[SKIP]` | Patikra šioje mašinoje neįmanoma |

Ataskaitos gale — `FAIL: n  WARN: n` ir bendras verdiktas.

## Ką tikrina

| Sritis | Windows | macOS / Linux |
|---|---|---|
| Mašinos identitetas, OS, modelis, serial, CPU | ✅ | ✅ |
| Veikimo laikas (kada perkrauta) | ✅ | ✅ |
| Laukiantis perkrovimas | ✅ | — |
| RAM ir swap / laisva atmintis | ✅ | ✅ |
| Diskų užimtumas kiekvienam tomui | ✅ | ✅ |
| Disko SMART sveikata + SSD nusidėvėjimas | ✅ | ✅ (Linux: `smartctl`) |
| Disko šifravimas | BitLocker | FileVault / LUKS |
| Antivirusinė (Defender + trečios šalies) | ✅ | — |
| Ugniasienė | ✅ | ✅ |
| Sistemos laikrodžio tikslumas | ✅ | ✅ |
| Baterijos talpa / būklė | ✅ | ✅ |
| Atsarginės kopijos | File History, atkūrimo taškai | Time Machine |
| Avarijos / žurnalo klaidos | System log 7 d. | panic 30 d. / journald |
| Daugiausiai CPU naudojantys procesai | ✅ | ✅ |
| Autostart programų kiekis | ✅ | — |
| Tinklas: IP, šliuzas, DNS, pasiekiamumas | ✅ | ✅ |
| Spausdintuvai ir spaudos eilė | ✅ | ✅ (CUPS) |
| Terminis droselis (perkaitimas) | — | ✅ macOS |
| OS atnaujinimai | `-Updates` | `--updates` |

Tinklo patikra tikrina du adresus: neutralų (`google.com` — ar internetas
gyvas) ir parduotuvės svetainę. Antrasis keičiamas:

```bash
SHOP_URL=https://kita.lt bash pc-check.sh                    # macOS / Linux
.\pc-check.ps1 -ShopUrl https://kita.lt                      # Windows
```

## Slenksčiai

Tai vertinimo sprendimai, ne fizikos konstantos — keisk pagal savo mašinas.

| Patikra | `[WARN]` | `[FAIL]` |
|---|---|---|
| Disko užimtumas | ≥80% | ≥90% |
| Neperkrauta | >30 d. | — |
| Laisva RAM | <10% | — |
| RAM iš viso | <8 GB | — |
| Swap naudojama (macOS) | >4 GB | — |
| Laikrodžio nuoslydis | >60 s | >300 s |
| SMART būsena | `Warning` | ne `Healthy`/`Verified` |
| SSD nusidėvėjimas | >80% | — |
| Baterijos talpa | <70% projektinės | — |
| Time Machine kopija | >2 d. | >7 d. |
| Defender parašai | >7 d. | — |
| System log klaidos (7 d.) | >100 | — |
| Autostart programų | >15 | — |
| Šifravimas išjungtas | ✅ | — |
| Ugniasienė išjungta | ✅ | — |

Kodėl laikrodis tikrinamas taip griežtai: nuklydęs laikrodis gadina kvitų
chronologiją, TLS rankos paspaudimus ir banko sutikrinimus — parduotuvėje tai
kritiškiau nei įprastame kompiuteryje.

## Kaip peržiūrėti rezultatus

Ataskaita yra grynas tekstas, todėl ją galima tiesiog įklijuoti į Claude sesiją:

```
Štai kasos-1 pc-check ataskaita: <įklijuoji turinį>
```

Verdiktai (`[FAIL]`, `[WARN]`) yra fiksuoto formato, tad iš karto matomas
prioritetų sąrašas. Kelių mašinų ataskaitas galima duoti iš karto — jas galima
sulyginti tarpusavyje ir pamatyti, kas bendra (pvz. visos be šifravimo) ir kas
išsiskiria.

## Žinomos ribos

- **Kasos programos / DB kopijų neaptinka.** Skriptas mato OS lygio kopijas
  (Time Machine, File History), bet ne kasos duomenų bazės eksportus. Tai
  tikrinama rankomis — ataskaitoje apie tai primenama `[INFO]` įrašu.
- **Windows PS 5.1.** Failas turi UTF-8 BOM, be jo PS 5.1 sudarkytų lietuviškus
  rašmenis. Nepašalink jo redaguodamas.
- **`Get-PrintJob`** kai kuriose Windows versijose reikalauja spausdinimo
  paslaugos; nesant jos patikra tyliai praleidžiama.
- **Linux SMART** be `smartmontools` neprieinamas (`apt install smartmontools`).
- **macOS Time Machine** be Full Disk Access terminalui grąžina „kopijų nerasta",
  nors jos yra — tai teisių, ne kopijų problema.
