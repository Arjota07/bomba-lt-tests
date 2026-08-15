---
description: Apklausia visas aktyvias Claude sesijas — kas liko nebaigta, ko laukia, ar galima archyvuoti
argument-hint: "[idle|visos|<dienos>d]"
allowed-tools: ListAgents, SendMessage, mcp__Claude_Code_Remote__list_sessions, mcp__Claude_Code_Remote__get_session, mcp__Claude_Code_Remote__list_triggers, mcp__Claude_Code_Remote__create_trigger, mcp__Claude_Code_Remote__fire_trigger, Bash
---

# Sesijų statuso apklausa

Išsiunčia vienodą statuso klausimą visoms aktyvioms Claude sesijoms ir surenka
atsakymus į vieną lentelę.

Argumentas: `$ARGUMENTS`

- `idle` arba tuščia — tik IDLE sesijos (numatytasis; neliečia dirbančių)
- `visos` — įskaitant RUNNING sesijas
- `<n>d` — tik tos, kurios neliestos daugiau nei n dienų (pvz. `7d`)

Komanda veikia ir Mac'e, ir debesyje, bet **skirtingais mechanizmais**. Pirmas
žingsnis — nustatyti, kuriuo.

---

## 0. Pasirink mechanizmą

Iškviesk `ListAgents`.

| `ListAgents` grąžina | Kelias | Kur |
|---|---|---|
| sesijų sąrašą | **A: SendMessage** (žr. 2A) | Mac su prijungtu Remote Control |
| „No reachable agents" | **B: Routine** (žr. 2B) | debesų sesija (iOS/web) |

Kelias A geresnis visais atžvilgiais — žinutė nueina tiesiai, atsakymas grįžta
atgal, nieko nelieka Routines sąraše. Rinkis jį, kai tik `ListAgents` ką nors
grąžina. Kelią B naudok tik tada, kai A neprieinamas.

Jei nė vienas neveikia (`ListAgents` tuščias **ir** `mcp__Claude_Code_Remote__*`
įrankių nėra) — pasakyk tai vartotojui ir stok. Nebandyk apeiti per `gh`,
`curl` ar API raktus.

---

## 1. Surink sesijų sąrašą

**Kelias A:** sąrašą duoda pats `ListAgents` — kiekviena eilutė prasideda
sesijos vardu, kuris ir yra adresas.

🔴 **`ListAgents` „started X ago" yra STARTO, ne paskutinio lietimo laikas.**
Pagal jį `<n>d` filtro daryti negalima: 2026-08-15 `homefolder-7c` buvo rodoma
„started 1d ago", nors iš tikrųjų aktyvi prieš 30 min.

Tikrą aktyvumą gauk **nemokamu zondu** — `SendMessage` su *bare* vardu, be
`[ref]`. Siuntimas nulūžta, sesija NEPABUNDA, turas nesunaudojamas, o klaidoje
įrašytas paskutinis aktyvumas:

```
SendMessage  to: homefolder-74   message: probe
→ "'homefolder-74' is not an agent in this conversation. Re-send with the ref…
   homefolder-74 [9081f7] — Claude session, on this machine, active 12h ago"
```

Zonduok visas kandidates vienu paketu (lygiagretūs iškvietimai), iš klaidų
susirink `active X ago` ir tik tada taikyk `<n>d` filtrą. Sesijoms, kurios
dirba dabar, `active` eilutės nebūna — jos į `<n>d` niekada nepatenka.

**Kelias B:** `mcp__Claude_Code_Remote__list_sessions` su `mine: true`,
`limit: 100`. Atsakymas beveik visada viršija tokenų ribą ir bus įrašytas į
failą. Neskaityk jo per `Read` — eilutės per ilgos. Filtruok per Bash:

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

**Visada praleisk savo paties sesiją.** Nusiuntus klausimą sau, gausis
begalinis ciklas.

---

## 2A. Kelias A — SendMessage

Kiekvienai atrinktai sesijai:

```
SendMessage
  to:      <vardas iš ListAgents eilutės>
  summary: statuso patikra
  message: <3 skyriaus tekstas>
```

Vardą kopijuok tiksliai taip, kaip jį atspausdino `ListAgents`. ` [ref]` pridėk
tik tada, kai dvi eilutės dalijasi tuo pačiu vardu arba klaida to paprašo.

Atsakymai ateina automatiškai, apvilkti `<cross-session-message from="...">` —
inbox'o tikrinti nereikia. Surink juos ir eik į 4 skyrių.

**Riba:** debesų sesija gauna žinutę, bet atsakyti atgal kol kas negali. Jei
tarp adresatų yra debesų sesijų, jų atsakymo nelauk — pasakyk vartotojui, kad
tas matyti tik pačiame pokalbyje.

---

## 2B. Kelias B — poke-only Routine

Naudoti tik kai `ListAgents` tuščias. `SendMessage` šių sesijų nepasiekia,
broadcast API nėra, tad vienintelis kelias — Routine, pririštas prie sesijos ID
ir paleidžiamas ranka.

Routine'us **pernaudok, nekurk kiekvieną kartą iš naujo**. Pirma `list_triggers`
ir ieškok jau esančio šiai sesijai pagal **abu** pavadinimų formatus:

- `sesijos-check:<session_id>` — dabartinis formatas
- `Statuso patikra — <sesijos pavadinimas>` — pirmoji, rankomis kurta karta
  (2026-08-15); tokių yra 10 ir jie veikia lygiai taip pat

Tada:

- **radai** (bet kuriuo formatu) → iškart `fire_trigger` su tuo ID
- **neradai** → `create_trigger`, tada `fire_trigger`

`create_trigger` parametrai:

- `name`: `sesijos-check:<session_id>`
- `persistent_session_id`: sesijos ID
- `prompt`: 3 skyriaus tekstas
- **be** `cron_expression` ir **be** `run_once_at` — taip Routine niekada
  nesuveiks savaime

Senųjų nepervadink ir netrink — `update_trigger` ir `delete_trigger` šioje
aplinkoje atmetami permission sluoksnyje (`create` ir `fire` praeina). Tvarkyti
ranka per claude.ai Routines UI.

Paleidinėk paketais po ~5. Permission dialogas gali atmesti visą paketą iš karto
(`Denied by user`) — tada nekartok aklai, o parodyk vartotojui, kurios atmestos,
ir paklausk, ar bandyti dar kartą.

---

## 3. Klausimo tekstas

Siųsk žodis žodin, kad atsakymai būtų palyginami tarp sesijų:

```
STATUSO PATIKRA (automatinė žinutė iš valdymo sesijos). Nevykdyk jokių komandų,
nekeisk failų, nedaryk commit'ų ar push.

ATSAKYK PER `SendMessage` ĮRANKĮ: `to` = šios žinutės `from` atributas, nukopijuotas
tiksliai (paprastas tekstas tavo pokalbyje manęs NEPASIEKIA). Lietuviškai, iki 10
eilučių:

1. Kas šioje sesijoje liko nebaigta? Trumpai, punktais.
2. Ko lauki iš manęs, kad galėtum tęsti? Jei nieko nelauki — parašyk „nieko".
3. Ar šią sesiją galima archyvuoti? TAIP / NE + vienas sakinys kodėl.
```

**Kodėl „per SendMessage" parašyta didžiosiomis:** 2026-08-15 Mac'o testas —
su formuluote „tik atsakyk tekstu" visos 3 apklaustos sesijos pabudo per ~10 s ir
atsakė, bet paprastu tekstu savo pokalbyje; valdymo sesija negavo nieko. Debesų
kelyje (B) tai nekliudo (ten skaitomas `post_turn_summary`), Mac'o kelyje (A) —
kritiška.

Neklausk „ar dar aktualu tęsti" — sesija to nežino, tai vartotojo sprendimas.
Klausk to, ką ji gali pasakyti tiksliai: kas nebaigta ir ko laukiama.

---

## 4. Surink atsakymus

**Kelias A:** atsakymai ateina kaip `<cross-session-message>` per ~10–30 s
(idle sesijos pabunda pačios — patikrinta 2026-08-15).

🔴 **`waiting` ≠ `idle`.** `idle` sesija pabunda pati; `waiting` sesija laukia
žmogaus (leidimo dialogo ar klausimo) ir eilės **nedrenuoja** — žinutė guli, kol
Andrius tą pokalbį atidarys. Patikrinta 2026-08-15: `homefolder-74` (`waiting`)
po 2,5 min neatsakė, o klausimas nebuvo pasiekęs net jos transkripto. Žinutė
neprarasta, bet savaime nesuveiks. `waiting` sesijų į apklausą **neįtrauk** —
arba įtrauk žinodamas, kad atsakymo nebus, ir taip ir parašyk ataskaitoje.

Atsakymo `from-name` yra sesijos **pavadinimas** (pvz. „Claude version update"),
ne `ListAgents` vardas (`homefolder-7c`) — susieti tenka pagal turinį.

Jei po ~2 min atsakymo nėra, sesija greičiausiai atsakė paprastu tekstu —
perskaityk jį iš jos transkripto (tik Mac'e, tik šios mašinos sesijoms):

```bash
grep -l "STATUSO PATIKRA (automatin" ~/.claude/projects/*/*.jsonl
```

ir iš rasto failo išspausdink `assistant` teksto blokus po tos eilutės
(`python3 -c` su `json.loads` per eilutę). Nesiųsk klausimo antrą kartą — tai
dar vienas turas tai sesijai.

**Kelias B:** palauk ~1–2 min, tada kiekvienai sesijai `get_session` ir skaityk
`post_turn_summary`:

- `status_category` — `need_input` (laukia tavęs) / `review_ready` (baigta)
- `status_detail` — ką nuveikė
- `needs_action` — ko konkrečiai laukia

**Svarbi riba:** `post_turn_summary` pildo tik `anthropic_cloud` sesijos.
`bridge` sesijos (Mac'o Claude Code CLI, žyma `remote-control-sdk`) jo nepildo —
jų atsakymus vartotojas matys tik atsidaręs pokalbį. Pasakyk tai atvirai,
neapsimesk, kad atsakymo nėra.

Jei `connection_status` yra `disconnected`, žinutė guli eilėje ir suveiks tik
tada, kai ta mašina prisijungs. Tai ne klaida — tiesiog pranešk.

---

## 5. Ataskaita

Markdown lentelė, surūšiuota: pirma `need_input`, paskui `review_ready`.

| Sesija | Būsena | Kas liko / ko laukia |
|---|---|---|

Po lentelės atskirai išvardink:

- sesijas, kurios atsakė „galima archyvuoti" → pasiūlyk `archive_session`
- sesijas, kurios dar neatsakė → nurodyk, ko jos laukia (prisijungimo ar turo)
