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

**Ką verta žinoti prieš paleidžiant:**

- Kiekviena apklausta sesija pabunda ir sunaudoja vieną turą — 10 sesijų kainuoja
  atitinkamai tokenų ir 5h limito.
- Debesų (iOS/web) sesijų atsakymus komanda perskaito pati per API.
- Mac'o (`bridge`) sesijų atsakymų per API perskaityti neįmanoma — juos matysi tik
  atsidaręs pokalbį Mac'e. Jei Mac'as tuo metu atjungtas, žinutė lauks eilėje.

## Routine'ų tvarkymas

Komanda kiekvienai sesijai laiko po vieną *poke-only* Routine ir jį pernaudoja.
Tokie Routine'ai patys niekada nesuveikia — tik kai juos paleidžia komanda.

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
