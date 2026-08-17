---
sritis: discogs
atnaujinta: 2026-08-17
galioja-iki: 2026-09-17
saltinis: PAVYZDYS — tikras kombainas rašo Discogs MCP užklausos rezultatą
tikrumas: juodrastis
---

# PAVYZDYS: kaip atrodo kombaino įrašas

Šis failas yra formos pavyzdys, ne duomenys. Ištrink jį, kai pirmas tikras
kombainas pradės rašyti.

Kombainas (suplanuotas agentas) niekada nerašo tiesiai į `sritys/`. Jis rašo
čia, į `inbox/`, su `tikrumas: juodrastis`. Patvirtinimas — tavo arba antro
agento — perkelia failą į sritį ir pakeičia žymą į `patvirtinta`.

## Ką kombainas privalo įrašyti

- **`saltinis`** — iš kur duomenys (MCP įrankis, laiškas, ataskaita) ir kada.
  Kai po pusmečio kils klausimas „iš kur mes tai žinom", atsakymas turi būti
  faile, o ne prisiminimuose.
- **`galioja-iki`** — kada šis faktas nustos būti patikimas be perpatikrinimo.
- **Tik pokytį, ne visą būklę.** „5 listingai nukrito žemiau konkurentų kainos"
  yra atmintis. Viso inventoriaus kopija — ne.

## Patvirtinimo eiga

```bash
# 1. peržiūri
cat inbox/2026-08-17-pavyzdys-kombaino-irasas.md

# 2. perkeli į sritį ir pakeiti tikrumą
git mv inbox/2026-08-17-pavyzdys-kombaino-irasas.md sritys/discogs/
# frontmatter: tikrumas: juodrastis → patvirtinta

# 3. patikrini ir įtrauki
npm run tikrinti && npm run indeksas
```

Nepatvirtinti įrašai lieka `inbox/` ir kas savaitę rodomi linterio ataskaitoje.
Jei įrašas guli patvirtinimo nesulaukęs mėnesį — jis arba nereikalingas, arba
kombainas renka ne tai.
