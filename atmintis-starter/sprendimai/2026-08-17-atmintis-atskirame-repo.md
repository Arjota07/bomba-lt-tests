---
sritis: meta
atnaujinta: 2026-08-17
galioja-iki: 2027-08-17
saltinis: bomba-lt-tests PR #9 analizė
tikrumas: patvirtinta
---

# Atmintis gyvena atskirame repo, ne projektų viduje

**Būsena:** priimta · **Data:** 2026-08-17

## Kontekstas

Iki šiol atmintis buvo `memory/` katalogas kiekviename projekte
(`imuzika-ops`, `muzikosirasai`), o abiejų `.gitignore` jį išmetė po 2026-06-10
saugumo audito, nes tarp žinių buvo kredencialų.

Pasekmės, kurias tai davė:

- vienintelis egzempliorius vienoje mašinoje, be backupo ir be istorijos;
- nematomas nė vienai debesų (iOS/web) sesijai;
- žinios pririštos prie repo, nors klausimai („kokia Bertus nuolaida",
  „koks PVM eBay UK") su repo nesusiję;
- dubliavimasis tarp dviejų projektų arba faktas, egzistuojantis tik viename.

## Sprendimas

Atmintis iškeliama į atskirą privatų repo `petriuko-atmintis`, skirstomą pagal
**sritis**, o ne pagal projektą. Kredencialai į atmintį nepatenka niekada —
lieka tik nuoroda į saugyklą. Tai leidžia repo laikyti git'e, o linteris su
secrets tikrinimu neleidžia klaidai pasikartoti.

Projektų `CLAUDE.md` tampa plonais rodykliais: projekto taisyklės (serveris,
PHP versija, darbo eiga) lieka, žinios išsikelia.

## Alternatyvos, kurios atmestos

**Palikti `memory/` projektuose ir tiesiog išvalyti kredencialus.** Išsprendžia
tik saugumą. Dubliavimasis, pririšimas prie repo ir dvigubas palaikymas lieka.

**Iš karto PostgreSQL + embeddings (7 lygis).** Per anksti: realiai bus 100–300
md failų, o `grep` tokiame mastelyje greitesnis ir tikslesnis. Klausimai (PVM
tarifas, katalogo nr., PPD kaina) reikalauja tikslių, ne „panašių" atsakymų.
Permissions sluoksnis neturi ką riboti, kol skaitytojas vienas.

**Notion / Obsidian vault.** Md failai lieka, bet dingsta git istorija, CI
linteris ir agentų rašymo kelias per commitą.

## Pasekmės

- Atmintis pasiekiama iš Mac, iOS ir web vienodai.
- Kiekvienas pakeitimas turi autorių, datą ir galimybę atsukti.
- Atsiranda vieta, kurios anksčiau nebuvo: `sprendimai/` — kodėl nusprendėm taip.
- Kaina: vienas papildomas repo ir vienkartinis `MASTER_MEMORY.md` skaidymas.

## Kada peržiūrėti

Kai atsiras antras žmogus, kuriam reikia matyti dalį, bet ne viską; arba failų
bus virš ~500; arba prireiks atsakymų, apimančių 20+ failų vienu metu. Tada — 7
lygis, kur md failai lieka SSOT, o duomenų bazė yra **tik indeksas**.
