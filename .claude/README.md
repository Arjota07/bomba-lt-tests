# `.claude/` — sesijų valdymo įrankiai

Šis katalogas **nesusijęs su Playwright testais**. Jis čia todėl, kad
`bomba-lt-tests` yra repo, kuriame paleidžiamos iOS/web Claude sesijos, o
`.claude/commands/` failai automatiškai tampa slash komandomis kiekvienoje
sesijoje, startuojančioje šiame repo.

## Komandos

| Komanda | Ką daro |
|---|---|
| `/sesijos` | Apklausia visas aktyvias Claude sesijas: kas liko nebaigta, ko laukia, ar galima archyvuoti |

### `/sesijos`

```
/sesijos          # tik IDLE sesijos (numatytasis)
/sesijos visos    # įskaitant šiuo metu dirbančias
/sesijos 7d       # tik neliestos daugiau nei 7 dienas
```

Grąžina lentelę su kiekvienos sesijos būsena ir pasiūlo, kurias galima
archyvuoti.

**Kiekviena apklausta sesija pabunda ir sunaudoja vieną turą** — 10 sesijų
kainuoja atitinkamai tokenų ir 5h limito.

## Įdiegimas į Mac (globaliai, visiems repo)

Debesų sesijose komanda atsiranda pati, nes jos startuoja šiame repo. Mac'e taip
nebus — ten dirbi kituose kataloguose. Sprendimas: įdėti failą į naudotojo lygio
komandų katalogą `~/.claude/commands/`, kuris galioja **visuose** projektuose.

**Diegimas ir atnaujinimas — tikru failu (rekomenduojama):**

```bash
mkdir -p ~/.claude/commands
git -C ~/Projektai/bomba.lt-tests pull
cp ~/Projektai/bomba.lt-tests/.claude/commands/sesijos.md ~/.claude/commands/sesijos.md
```

Ta pati komanda ir įdiegia, ir atnaujina — paleisk ją po kiekvieno šio failo
pakeitimo repo.

**Kodėl ne symlink.** Symlink atnaujintų komandą automatiškai su `git pull`, bet
lūžta, kai tik klonuotė atsiduria šakoje be šio failo — būtent taip ir nutiko
2026-08-15 10:09 (symlink rodė į `master`, kuriame failo dar nebuvo; `/sesijos`
tiesiog neegzistavo). Tikras failas nuo to apsaugotas; kaina — reikia paleisti
`cp` po pakeitimų.

**⚠️ Mac'e yra DVI šio repo klonuotės** (abi rodo į `Arjota07/bomba-lt-tests`):

| Kelias | Būsena |
|---|---|
| `~/Projektai/bomba.lt-tests` (su **tašku**) | aktyvi — ją naudok |
| `~/Projektai/bomba-lt-tests` (su **brūkšneliu**) | senesnė, atsilikusi |

Repo slug yra `bomba-lt-tests`, bet aktyvus katalogas — su tašku. Prieš `pull`
patikrink, kad esi tame, kurio HEAD naujesnis.

Po to bet kuriame Mac'o projekte veikia `/sesijos`.

## Du mechanizmai

Komanda pati pasirenka kelią pagal tai, ką grąžina `ListAgents`:

| Aplinka | `ListAgents` | Mechanizmas | Atsakymai |
|---|---|---|---|
| **Mac** (Remote Control prijungtas) | grąžina sesijas | `SendMessage` tiesiai | grįžta atgal automatiškai |
| **Debesys** (iOS/web) | tuščias | poke-only Routine per `fire_trigger` | skaitomi iš `post_turn_summary` |

Mac'o kelias geresnis: žinutė nueina tiesiai, atsakymas grįžta, Routines sąraše
nieko nelieka. Todėl `/sesijos` verta paleidinėti būtent iš Mac'o, kai tik jis
įjungtas.

Žinomos ribos:

- Apklausta sesija **turi atsakyti per `SendMessage`** — jos paprastas tekstas
  valdymo sesijos nepasiekia. Klausimo tekstas to reikalauja aiškiai (pataisyta
  po 2026-08-15 Mac'o testo: su „tik atsakyk tekstu" visos 3 sesijos atsakė
  pokalbyje ir nieko negrįžo). Atsakymo `from-name` yra sesijos **pavadinimas**
  (pvz. „Claude version update"), ne `ListAgents` vardas (`homefolder-7c`);
  Remote Control (`bridge`) sesijos atsakymas ateina su `from="unknown"`.
- Idle Mac'o sesijos pabunda pačios ir atsako per ~10–30 s (patikrinta
  2026-08-15, transportai `uds` ir `bridge`). Neatėjus atsakymui — jį galima
  perskaityti iš sesijos transkripto `~/.claude/projects/*/*.jsonl` (žr. komandos
  4 skyrių), nesiunčiant klausimo antrą kartą.
- **`waiting` būsenos sesija eilės nedrenuoja** — ji laukia žmogaus, tad žinutė
  guli, kol pokalbis atidaromas (2026-08-15: `homefolder-74`, 2,5 min be atsako,
  klausimas nepasiekė net jos transkripto). Pabunda tik `idle`.
- **`ListAgents` rodo starto, ne paskutinio lietimo laiką**, tad `<n>d` filtrui
  jo duomenų neužtenka. Tikrą `active X ago` grąžina `SendMessage` su bare vardu
  (be `[ref]`) — siuntimas nulūžta, sesija nepabunda, turas nesunaudojamas.
- Debesų sesija gauna `SendMessage` žinutę, bet atsakyti atgal kol kas negali —
  jos atsakymas matomas tik pačiame pokalbyje.
- `bridge` (Mac) sesijos nepildo `post_turn_summary`, todėl debesų kelias jų
  atsakymų perskaityti negali.
- Atjungtai mašinai žinutė guli eilėje, kol ji prisijungs.

## Routine'ų tvarkymas

Debesų kelias kiekvienai sesijai laiko po vieną *poke-only* Routine ir jį
pernaudoja. Tokie Routine'ai patys niekada nesuveikia — tik kai juos paleidžia
komanda.

Ištrinti juos iš sesijos neįmanoma: `delete_trigger` ir `update_trigger` yra
atmetami permission sluoksnyje (`create` ir `fire` praeina). Jei Routines
sąrašas per ilgas, valyk ranka per claude.ai Routines UI.

## Automatinis paleidimas

Komandą galima pakabinti ant Routine, kad suveiktų pati. Pavyzdžiui kas rytą
8:00 Vilniaus laiku (= 05:00 UTC vasarą, 06:00 UTC žiemą):

```
create_trigger
  name:                      Rytinė sesijų apklausa
  cron_expression:           0 5 * * 1-5
  create_new_session_on_fire: true
  prompt:                    <visas /sesijos komandos tekstas, standalone>
  notifications:             {push: true}
```

Svarbu: `create_new_session_on_fire: true` sukuria naują sesiją kiekvienam
paleidimui, todėl `prompt` turi būti savarankiškas — nuoroda `/sesijos` naujoje
sesijoje neveiks tol, kol ji nestartuos šiame repo.
