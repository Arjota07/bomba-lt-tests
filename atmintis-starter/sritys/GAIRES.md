---
sritis: meta
atnaujinta: 2026-08-17
galioja-iki: 2027-08-17
saltinis: atminties architektūros planas (bomba-lt-tests PR #9)
tikrumas: patvirtinta
---

# Kas gyvena kurioje srityje

Skirstymo principas: **pagal klausimą, kurį užduosi**, ne pagal repo, kuriame
kodas. „Kokia Bertus dilerinė nuolaida" nėra PrestaShop klausimas, net jei
atsakymas kažkada buvo užrašytas PrestaShop projekto atmintyje.

| Sritis | Ką dedi | Ko NEDEDI |
|---|---|---|
| `pardavimai` | kanalų apyvartos, maržos, sezoniškumas, kainodaros taisyklės | konkrečių listingų kainas — jos gyvena platformoje |
| `tiekejai` | dilerinės nuolaidos, PPD logika, užsakymo minimumai, kontaktai | kainynų PDF — tik iš jų išvestas faktas |
| `discogs` | inventoriaus taisyklės, perkainojimo politika, ginčų praktika | užsakymų istoriją — ji Discogs pusėje |
| `ebay` | UK specifika, item specifics, VAT traktavimas, listingo šablonai | atskirus listingus |
| `buhalterija` | PVM pagal kanalą, SF serijos, kasos žymėjimas, sąskaitų planas | pačius dokumentus |
| `klientai` | atsakymų tonas, tipiniai atvejai, grąžinimų politika | asmens duomenis |
| `it-infra` | serveriai, PrestaShop/Laravel specifika, Claude sesijų mechanika | kredencialus — tik nuorodas į saugyklą |
| `marketing` | kampanijų rezultatai, auditorijų segmentai, UTM konvencijos | laiškų HTML |

## Kai nežinai, kur dėti

Jei faktas tinka dviem sritims — jis greičiausiai per platus ir yra du faktai.
Skaidyk. Jei tikrai nedalomas, dėk į tą sritį, iš kurios jo ieškosi *pirmiausia*,
ir iš antrosios pridėk nuorodą, o ne kopiją. Linteris kopijas gaudo.

## Failo dydis

Riba — 200 eilučių. Peraugęs failas skyla pagal potemę, o ne auga toliau. Tai
vienintelė taisyklė, neleidžianti atsirasti antram `MASTER_MEMORY.md`.
