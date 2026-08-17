# Kombainai — 6 lygis

Suplanuoti agentai, kurie patys renka informaciją ir papildo atmintį. Kiekvienas —
Routine su `create_new_session_on_fire: true`, todėl **promptas turi būti
savarankiškas**: nauja sesija nieko neatsimena.

Pradėk nuo dviejų, ne penkių. Kombainas, kurio produkcijos netikrini, yra
šlamšto generatorius.

## Bendra taisyklė kiekvienam promptui

Kiekvienas kombainas rašo **tik į `inbox/`**, su `tikrumas: juodrastis` ir
privalomu `saltinis`. Į `sritys/` perkelia tik žmogus arba patvirtinimo agentas.

---

## 1. Discogs — kasdien 07:00 Vilniaus laiku

`cron_expression: 0 5 * * *` (vasarą; žiemą `0 6 * * *`)

```
Esi Discogs inventoriaus stebėtojas Music.ShopLT parduotuvei.

1. Per Discogs MCP surink per paskutines 24 val.:
   - naujus užsakymus ir jų būsenas
   - listingus, kurių kaina nukrito žemiau konkurentų TOP1
   - listingus be pardavimo daugiau nei 180 d.
2. Klonuok repo petriuko-atmintis.
3. Sukurk failą inbox/YYYY-MM-DD-discogs.md su frontmatter:
   sritis: discogs
   atnaujinta: <šiandien>
   galioja-iki: <šiandien + 30 d.>
   saltinis: Discogs MCP, automatinis surinkimas <šiandien>
   tikrumas: juodrastis
4. Rašyk TIK POKYTĮ, ne visą inventoriaus būklę. Jei per parą niekas
   nepasikeitė — failo nekurk ir baik darbą be commito.
5. Paleisk `npm run tikrinti`. Jei linteris rado klaidų — taisyk, nekomitink
   su klaidomis.
6. Commit + push į šaką `kombainas/discogs-YYYY-MM-DD`, atidaryk draft PR.
```

---

## 2. Savaitės pardavimai — pirmadieniais

`cron_expression: 0 5 * * 1`

```
Esi imuzika.lt savaitės pardavimų analitikas.

1. Prisijunk prie PrestaShop DB pagal imuzika-ops CLAUDE.md taisykles
   (PRIEŠ bet kokį serverio veiksmą — klausk leidimo, jei sesija interaktyvi;
   suplanuotame paleidime naudok tik READ-ONLY užklausas).
2. Surink praėjusios savaitės: apyvartą pagal kanalą, TOP 10 prekių,
   vidutinį krepšelį, palyginimą su prieš tai buvusia savaite ir su tuo
   pačiu laikotarpiu pernai.
3. Klonuok petriuko-atmintis, sukurk inbox/YYYY-Www-pardavimai.md:
   sritis: pardavimai
   galioja-iki: <šiandien + 90 d.>
   saltinis: PrestaShop DB, read-only užklausa <data>
   tikrumas: juodrastis
4. Įrašyk IŠVADAS, ne lentelių eksportą. „K-pop dalis augo nuo X iki Y%
   trečią savaitę iš eilės" yra atmintis; 200 eilučių SQL rezultatas — ne.
5. `npm run tikrinti`, commit, draft PR.
```

---

## 3. Savaitinė atminties peržiūra — šeštadieniais

`cron_expression: 0 6 * * 6` · `notifications: {push: true}`

```
Esi petriuko-atmintis prižiūrėtojas.

1. Klonuok petriuko-atmintis, paleisk `node scripts/lint.mjs --json`.
2. Surašyk:
   - kiek įrašų pasenę (galioja-iki praėjusi) ir kurie
   - kiek guli inbox/ nepatvirtinta ir kiek laiko
   - galimus dublikatus
3. Jei inbox/ įrašas guli daugiau nei 30 d. — pažymėk atskirai: jis arba
   nereikalingas, arba kombainas renka ne tai.
4. Atsakyk trumpa suvestine. Nieko netaisyk pats — peržiūra yra žmogaus
   sprendimas.
```

---

## Ko kombainai NEDARO

- **Nerašo į `sritys/`.** Niekada, jokiomis aplinkybėmis.
- **Netrina ir nekeičia esamų failų.** Tik kuria naujus `inbox/`.
- **Nerašo kredencialų.** Jei radinys turi slaptažodį — įrašo nuorodą į
  saugyklą, o pačios reikšmės neperkelia. Linteris tai vis tiek blokuotų.
- **Nerašo tuščių įrašų.** Nieko nepasikeitė — nieko ir nekuria. Kitaip
  atmintis prisipildo „šiandien pokyčių nebuvo" failų.
