# <projektas> — <ką jis daro>

Šablonas plonam `CLAUDE.md`. Principas: čia lieka tik tai, kas galioja **šiam
repo ir niekur kitur**. Viskas, ką atsimintum ir dirbdamas kitame projekte,
keliauja į `petriuko-atmintis`.

## SERVERIO TAISYKLĖ (NIEKADA NEPAŽEISTI)
- Šis projektas = **<domenas>** (<platforma ir versija>)
- Serveris: **VISADA `<hostas>`**
- **NIEKADA nenaudoti `<kito projekto hostas>`** iš šio projekto
- **NIEKADA nekeisti `<kito projekto domenas>`** failų

## Prisijungimai
Kredencialai `.env` faile ir 1Password seife `<seifo vardas>`.
**Šiame faile slaptažodžių nėra ir nebus** — jei matai, vadinasi, kažkas
apėjo pre-commit hook'ą, ir juos reikia pasukti, o ne tik ištrinti.

## Vartotojas
- Andrius (Petriukas), UAB MILVID, andrius@imuzika.lt

## Kalba
- Visada bendrauk lietuviškai
- Kodo komentarai ir commit žinutės gali būti angliškai

## Darbo eiga (PRIVALOMA)
- **PRIEŠ BET KOKĮ serverio veiksmą** (SSH, SCP, DB, cache valymas) — **KLAUSTI ANDRIAUS LEIDIMO**
- Darbo tvarka: parašyti lokaliai → parodyti ką padarei → klausti „Kelti į serverį?"
- **PO KIEKVIENO ATLIKTO DARBO** — duoti **5 pasirinkimus** ką daryti toliau
- **Prieš keičiant failus — VISADA backup**

## Techniniai apribojimai
- <PHP/Node versija ir ką ji draudžia>
- <kas serveryje išjungta>

## Atmintis
Verslo, tiekėjų, kanalų, buhalterijos ir kainodaros žinios — **ne čia**, o
`petriuko-atmintis` repo:

- `INDEX.md` — visų įrašų sąrašas su šviežumo žymomis (generuojamas)
- `sritys/<sritis>/` — žinios pagal sritį
- `sprendimai/` — kodėl nusprendėm taip

Mac'e: `~/Projektai/petriuko-atmintis`.
Debesyse ir mobiliajame: per atminties MCP serverį (`atmintis_ieskoti`).

Radęs faktą, kurio atmintyje nėra — rašyk į `inbox/`, ne į šį failą.
