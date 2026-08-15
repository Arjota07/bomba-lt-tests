---
description: Apklausia visas aktyvias Claude sesijas — kas liko nebaigta, ko laukia, ar galima archyvuoti
argument-hint: "[idle|visos|<dienos>d]"
allowed-tools: mcp__Claude_Code_Remote__list_sessions, mcp__Claude_Code_Remote__get_session, mcp__Claude_Code_Remote__list_triggers, mcp__Claude_Code_Remote__create_trigger, mcp__Claude_Code_Remote__fire_trigger, mcp__Claude_Code_Remote__delete_trigger, Bash
---

# Sesijų statuso apklausa

Išsiunčia vienodą statuso klausimą visoms aktyvioms Claude sesijoms ir surenka
atsakymus į vieną lentelę.

Argumentas: `$ARGUMENTS`

- `idle` arba tuščia — tik IDLE sesijos (numatytasis; neliečia dirbančių)
- `visos` — įskaitant RUNNING sesijas
- `<n>d` — tik tos, kurios neliestos daugiau nei n dienų (pvz. `7d`)

## 1. Surink sesijų sąrašą

Iškviesk `mcp__Claude_Code_Remote__list_sessions` su `mine: true`, `limit: 100`.

Atsakymas beveik visada viršija tokenų ribą ir bus įrašytas į failą. Neskaityk jo
per `Read` — eilutės per ilgos. Filtruok per Bash:

```bash
python3 -c "
import json, sys
d = json.load(open(sys.argv[1]))['ccr']
for x in d['data']:
    if x['session_status'] == 'SESSION_STATUS_ARCHIVED':
        continue
    print(x['session_status'][15:], x.get('connection_status'), x.get('environment_kind'),
          x['updated_at'][:16], x['id'], '|', x['title'][:60])
print('has_more', d['has_more'], 'last_id', d['last_id'])
" <failo-kelias>
```

Jei `has_more` yra `true` — kartok su `after_id: <last_id>`, kol nebeliks
neaarchyvuotų sesijų. Praktikoje senesnės nei ~2 sav. jau visos archyvuotos, tad
po pirmo puslapio be naujų radinių gali stoti.

**Visada praleisk savo paties sesiją** — jos ID yra sistemos prompt'e nurodytoje
sesijos nuorodoje. Nusiuntus klausimą sau, gausis begalinis ciklas.

## 2. Kiekvienai atrinktai sesijai — Routine

Tiesioginio „broadcast" API nėra ir `SendMessage` šių sesijų nepasiekia
(`ListAgents` grąžina tuščią sąrašą, nes Remote Control čia neprijungtas).
Vienintelis veikiantis kelias — *poke-only* Routine, pririštas prie sesijos ID.

Routine'us **pernaudok, nekurk kiekvieną kartą iš naujo**. Pirma iškviesk
`list_triggers` ir ieškok jau esančio šiai sesijai pagal **abu** pavadinimų
formatus:

- `sesijos-check:<session_id>` — dabartinis formatas
- `Statuso patikra — <sesijos pavadinimas>` — pirmoji, rankomis kurta karta
  (2026-08-15); tokių yra 10 ir jie veikia lygiai taip pat

Tada:

- **radai** (bet kuriuo formatu) → iškart `fire_trigger` su tuo ID
- **neradai** → `create_trigger` (žemiau), tada `fire_trigger`

Senųjų nepervadink ir netrink — `update_trigger` ir `delete_trigger` šioje
aplinkoje atmetami permission sluoksnyje. Jei vartotojas nori tvarkos Routines
sąraše, tai daroma ranka per claude.ai Routines UI.

`create_trigger` parametrai:

- `name`: `sesijos-check:<session_id>` — stabilus, mašinai atpažįstamas
- `persistent_session_id`: sesijos ID
- `prompt`: 3 skyriaus tekstas
- **be** `cron_expression` ir **be** `run_once_at` — taip Routine niekada
  nesuveiks savaime, tik kai jį paleidi rankiniu būdu

Paleidinėk paketais po ~5. Permission dialogas gali atmesti visą paketą iš karto
(`Denied by user`) — tokiu atveju nekartok tų pačių kvietimų aklai, o parodyk
vartotojui, kurios atmestos, ir paklausk, ar bandyti dar kartą.

## 3. Klausimo tekstas

Siųsk žodis žodin, kad atsakymai būtų palyginami tarp sesijų:

```
STATUSO PATIKRA (automatinė žinutė iš valdymo sesijos). Nevykdyk jokių komandų,
nekeisk failų, nedaryk commit'ų ar push. Tik atsakyk tekstu, lietuviškai, iki 10
eilučių:

1. Kas šioje sesijoje liko nebaigta? Trumpai, punktais.
2. Ko lauki iš manęs, kad galėtum tęsti? Jei nieko nelauki — parašyk „nieko".
3. Ar šią sesiją galima archyvuoti? TAIP / NE + vienas sakinys kodėl.
```

Neklausk „ar dar aktualu tęsti" — sesija to nežino, tai vartotojo sprendimas.
Klausk to, ką ji gali pasakyti tiksliai: kas nebaigta ir ko laukiama.

## 4. Surink atsakymus

Palauk ~1–2 min, tada kiekvienai sesijai `get_session` ir skaityk
`post_turn_summary`:

- `status_category` — `need_input` (laukia tavęs) / `review_ready` (baigta)
- `status_detail` — ką nuveikė
- `needs_action` — ko konkrečiai laukia

**Svarbi riba:** `post_turn_summary` pildo tik `anthropic_cloud` sesijos.
`bridge` sesijos (Mac'o Claude Code CLI, žyma `remote-control-sdk`) jo nepildo —
jų atsakymus vartotojas matys tik atsidaręs pokalbį Mac'e. Pasakyk tai atvirai,
neapsimesk, kad atsakymo nėra.

Jei `connection_status` yra `disconnected`, žinutė guli eilėje ir suveiks tik
tada, kai tas Mac'as prisijungs. Tai ne klaida — tiesiog pranešk.

## 5. Ataskaita

Markdown lentelė, surūšiuota: pirma `need_input`, paskui `review_ready`.

| Sesija | Būsena | Kas liko / ko laukia |
|---|---|---|

Po lentelės atskirai išvardink:

- sesijas, kurios atsakė „galima archyvuoti" → pasiūlyk `archive_session`
- sesijas, kurios dar neatsakė (disconnected) → nurodyk, kad lauks Mac'o

## 6. Sutvarkyk

Routine'ų **netrink** — jie pernaudojami kitam paleidimui ir patys niekada
nesuveiks. Ištrink (`delete_trigger`) tik tada, kai sesija archyvuojama arba
vartotojas paprašo išvalyti.
