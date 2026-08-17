---
sritis: pardavimai          # pardavimai | tiekejai | discogs | ebay | buhalterija | klientai | it-infra | marketing
atnaujinta: 2026-01-01      # YYYY-MM-DD, kada paskutinį kartą PATIKRINTA (ne kada redaguota)
galioja-iki: 2026-04-01     # po šios datos linteris rėks, kad reikia peržiūros
saltinis: iš kur žinom      # dokumentas, laiškas, MCP įrankis, pokalbis + data
tikrumas: juodrastis        # patvirtinta | juodrastis | spejimas
---

# Trumpas pavadinimas be datos

Vienas failas — viena tema. Riba 200 eilučių; peraugęs skyla, o ne auga.

## Faktas

Rašyk teiginiais, kuriuos galima patikrinti. „Bertus dilerinė nuolaida yra X%
nuo katalogo kainos, minimalus užsakymas Y EUR" — tai faktas. „Bertus geras
tiekėjas" — ne.

## Kredencialai

Niekada čia. Vietoj reikšmės — nuoroda:

> SSH į serverį — slaptažodis 1Password įraše `<įrašo vardas>`.

Linteris blokuoja commitą radęs `slaptažodis: reikšmė`, `sshpass -p`, API raktus
ar Basic auth antraštes. Nuorodos formos (`1Password`, `op://`, `${KINTAMASIS}`,
`.env`) praeina.

## Kai faktas pasikeičia

Keisk vietoje ir atnaujink `atnaujinta` + `galioja-iki`. Senos reikšmės istorija
lieka git'e — jos kartoti faile nereikia. Jei faktas nustojo galioti visai —
`git mv` į `archyvas/`, kur `galioja-iki` nebeprivalomas.
