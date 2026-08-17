---
sritis: it-infra
atnaujinta: 2026-08-17
galioja-iki: 2026-11-17
saltinis: bomba-lt-tests/.claude/README.md (perkelta 2026-08-17), Mac'o testai 2026-08-15
tikrumas: patvirtinta
---

# Claude sesijų mechanika

Brangiai užsidirbtos operacinės žinios apie `/sesijos` komandą ir sesijų
valdymą. Iki 2026-08-17 gulėjo `bomba-lt-tests/.claude/README.md` — testų repo
README'e, kur jų niekas neieškotų.

## Du mechanizmai

Komanda pati pasirenka kelią pagal tai, ką grąžina `ListAgents`.

| Aplinka | `ListAgents` | Mechanizmas | Atsakymai |
|---|---|---|---|
| Mac (Remote Control prijungtas) | grąžina sesijas | `SendMessage` tiesiai | grįžta automatiškai |
| Debesys (iOS/web) | tuščias | poke-only Routine per `fire_trigger` | skaitomi iš `post_turn_summary` |

Mac'o kelias geresnis: žinutė nueina tiesiai, atsakymas grįžta, Routines sąraše
nieko nelieka. Todėl `/sesijos` verta paleidinėti iš Mac'o, kai tik jis įjungtas.

## Žinomos ribos

- **Apklausta sesija turi atsakyti per `SendMessage`** — jos paprastas tekstas
  valdymo sesijos nepasiekia. Su formuluote „tik atsakyk tekstu" (2026-08-15
  testas) visos 3 sesijos atsakė pokalbyje ir nieko negrįžo.
- Atsakymo `from-name` yra sesijos **pavadinimas** (pvz. „Claude version
  update"), ne `ListAgents` vardas (`homefolder-7c`). Remote Control (`bridge`)
  sesijos atsakymas ateina su `from="unknown"`.
- Idle Mac'o sesijos pabunda pačios ir atsako per ~10–30 s (patikrinta
  2026-08-15, transportai `uds` ir `bridge`).
- **`waiting` būsenos sesija eilės nedrenuoja** — ji laukia žmogaus, tad žinutė
  guli, kol pokalbis atidaromas. 2026-08-15: `homefolder-74`, 2,5 min be atsako,
  klausimas nepasiekė net jos transkripto. Pabunda tik `idle`.
- **`ListAgents` rodo starto, ne paskutinio lietimo laiką**, tad `<n>d` filtrui
  jo duomenų neužtenka. Tikrą `active X ago` grąžina `SendMessage` su bare vardu
  (be `[ref]`) — siuntimas nulūžta, sesija nepabunda, turas nesunaudojamas.
- Debesų sesija gauna `SendMessage` žinutę, bet atsakyti atgal kol kas negali —
  jos atsakymas matomas tik pačiame pokalbyje.
- `bridge` (Mac) sesijos nepildo `post_turn_summary`, todėl debesų kelias jų
  atsakymų perskaityti negali.
- **`disconnected` sesija gali nebeatsigauti niekada** — miršta atskiros sesijos
  procesas, ne visas Remote Control, tad mašinos prisijungimas jos neišjudina.
  2026-08-15: 7 sesijos su 06:42 žinute liko negyvos ir po 6 val., kai kitos to
  paties Mac'o sesijos jau dirbo. Požymis — `updated_at`, sustingęs ties žinutės
  įmetimo laiku. Išjudinti galima tik iš tos mašinos.

## Kaina

Kiekviena apklausta sesija pabunda ir sunaudoja vieną turą — 10 sesijų kainuoja
atitinkamai tokenų ir 5 val. limito.

## Routine'ų valymas

Debesų kelias kiekvienai sesijai laiko po vieną poke-only Routine ir jį
pernaudoja. Tokie Routine'ai patys niekada nesuveikia. Ištrinti jų iš sesijos
neįmanoma: `delete_trigger` ir `update_trigger` atmetami permission sluoksnyje
(`create` ir `fire` praeina). Jei sąrašas per ilgas — valyk ranka per claude.ai
Routines UI.

## Symlink pamoka (2026-08-15)

`~/.claude/commands/sesijos.md` buvo symlink į repo failą. Kai klonuotė atsidūrė
šakoje be to failo, symlink nulūžo ir `/sesijos` tiesiog neegzistavo. Sprendimas —
tikras failas su `cp` po kiekvieno pakeitimo. Symlink'o patogumas neatsveria
tylaus dingimo.

## Mac'o klonuotės

Yra **dvi** to paties repo klonuotės, abi rodo į `Arjota07/bomba-lt-tests`:

| Kelias | Būsena |
|---|---|
| `~/Projektai/bomba.lt-tests` (su **tašku**) | aktyvi — ją naudok |
| `~/Projektai/bomba-lt-tests` (su **brūkšneliu**) | senesnė, atsilikusi |

Repo slug yra `bomba-lt-tests`, bet aktyvus katalogas — su tašku. Prieš `pull`
patikrink, kurio HEAD naujesnis.
