# `MASTER_MEMORY.md` skaidymas — promptas Mac'o sesijai

Šio darbo iš debesų padaryti neįmanoma: `memory/` yra gitignored, todėl matomas
tik Mac'e. Startuok Claude Code sesiją Mac'e ir įklijuok žemiau esantį tekstą.

Paleisk **du kartus** — atskirai `imuzika-ops` ir `muzikosirasai` atmintims.

---

## Promptas

```
Skaidau seną atmintį į naują struktūrą.

ŠALTINIAI (tik skaityti, nekeisti):
  ~/Projektai/<projektas>/memory/MEMORY.md
  ~/Projektai/<projektas>/memory/MASTER_MEMORY.md

TIKSLAS: ~/Projektai/petriuko-atmintis

EIGA — trys etapai, po kiekvieno sustok ir parodyk man:

1 ETAPAS — INVENTORIUS. Perskaityk abu šaltinius. NIEKO DAR NERAŠYK.
   Pateik lentelę: kokias temas radai, kiek eilučių kiekviena, į kurią sritį
   siūlai dėti (pardavimai / tiekejai / discogs / ebay / buhalterija /
   klientai / it-infra / marketing), ir koks siūlomas failo vardas.
   Sritis rinkis pagal sritys/GAIRES.md.
   Atskirai išvardyk: (a) ką laikai pasenusiu, (b) ką laikai dubliu,
   (c) ką radai, bet nesupratai. Sustok ir lauk mano „TAIP".

2 ETAPAS — KREDENCIALAI. Prieš rašydamas bet ką į repo, surink VISUS
   šaltiniuose rastus slaptažodžius, API raktus, tokenus ir prisijungimus
   į failą ~/Desktop/atmintis-kredencialai.txt (NE į repo, NE į git).
   Į atmintį jų vietoje rašysi tik nuorodą, pvz.:
     „SSH į <serveris> — slaptažodis 1Password įraše <įrašo vardas>."
   Pasakyk man, kiek jų radai. Aš juos sudėsiu į 1Password ir failą ištrinsiu.
   Sustok ir lauk „TAIP".

3 ETAPAS — RAŠYMAS. Kurk failus pagal patvirtintą planą.

TAISYKLĖS RAŠANT:
- Vienas failas = viena tema. Riba 200 eilučių — peraugo, skaidyk.
- Privalomas frontmatter (šablonas: templates/faktas.md):
    sritis, atnaujinta, galioja-iki, saltinis, tikrumas
- `atnaujinta` — data, kada faktas paskutinį kartą PATIKRINTAS. Jei nežinai,
  imk seniausią įrodomą datą, ne šiandieną. Šiandienos data melagingai
  pasakytų, kad faktas šviežias.
- `galioja-iki`: buhalterija +12 mėn. · tiekejai +3 mėn. · it-infra +3 mėn. ·
  visa kita +6 mėn.
- `saltinis`: „MASTER_MEMORY.md (<projektas>), perkelta <data>"
- `tikrumas`: `patvirtinta` TIK jei faktą gali patikrinti dabar.
  Jei tai buvo užrašyta kadaise ir nepatikrinta — `spejimas`.
  Jei nesupratai, ką reiškia — NEKURK failo sritys/ viduje, dėk į
  inbox/ su `tikrumas: juodrastis` ir aprašyk, ko neaišku.
- JOKIŲ kredencialų. Niekada. Tik nuoroda į saugyklą.
- Faktą rašyk VIENĄ kartą. Kartojasi abiejuose šaltiniuose — sujunk į vieną
  failą, o ne kopijuok. Linteris dublikatus gaudo.
- Pasenusio nemesk — kelk į archyvas/ (ten `galioja-iki` neprivalomas).

PO KIEKVIENŲ ~5 FAILŲ:
    cd ~/Projektai/petriuko-atmintis && npm run tikrinti
  Klaidas taisyk iškart, nesikaupk.

PABAIGOJE:
    npm run tikrinti && npm run indeksas && npm test
    git add -A && git commit -m "atmintis: <projektas> MASTER_MEMORY skaidymas"
  Ir parodyk man INDEX.md.

KO NEDARYK:
- Netrink ir nekeisk šaltinio memory/ failų — jie lieka, kol nepatvirtinsiu,
  kad perkėlimas pavyko.
- Nekurk failų, kurių turinio nesupratai — geriau inbox/ su klausimu.
- Neišgalvok datų, sumų ar kodų. Nėra šaltinyje — sakyk, kad nėra.
```

---

## Po abiejų paleidimų

1. Peržiūrėk `INDEX.md` — ar sričių pasiskirstymas atrodo teisingas.
2. Peržiūrėk `inbox/` — ten viskas, ko sesija nesuprato. Tai tavo sprendimų
   sąrašas.
3. `~/Desktop/atmintis-kredencialai.txt` — į 1Password, tada `rm`.
4. Tik tada senuosius `memory/` katalogus galima archyvuoti.
