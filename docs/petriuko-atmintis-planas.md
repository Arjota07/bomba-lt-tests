# Petriuko atmintis → asistento smegenys

Analizė ir pasiūlymai, kaip dabartinę `memory/` sistemą paversti tikromis
asistento smegenimis. Vertinta pagal 5–7 lygių modelį (Antrosios smegenys →
Konteksto rinkimas → Įmonės smegenys).

Parengta 2026-08-17.

---

## 1. Kas yra dabar

| Sluoksnis | Kur gyvena | Būsena |
|---|---|---|
| Taisyklės + kredencialai + statusas | `CLAUDE.md` kiekviename projekte | git'e, ~2–5 KB, sumaišyta |
| Faktinė atmintis | `memory/MEMORY.md` (indeksas) + `memory/MASTER_MEMORY.md` | **gitignored**, tik Mac'e |
| Procedūrinė atmintis | 33 synced skills (`~/.claude/skills/synced/`) | sinchronizuojasi per akauntą, veikia **visur** |
| Projekto skills | `imuzika-ops/skills/` (discogs, ebay, imuzika, last30days) | git'e, tik tame repo |
| Sesijų orkestravimas | `bomba-lt-tests/.claude/commands/sesijos.md` | git'e, veikia |
| Operacinės žinios | `bomba-lt-tests/.claude/README.md` | git'e, bet atsitiktinėje vietoje |

Abiejuose projektuose (`imuzika-ops`, `muzikosirasai`) `CLAUDE.md` baigiasi ta
pačia eilute:

```
## Atmintis
- Prieš darbą peržiūrėk `memory/MEMORY.md` — ten indeksas
- `memory/MASTER_MEMORY.md` — pilnas kontekstas
```

O `.gitignore` abiejuose sako:

```
# Saugumo auditas 2026-06-10: secrets katalogai niekada negrizta i git
memory/
```

---

## 2. Diagnozė — kur lūžta

### 2.1. Atmintis nepasiekiama ten, kur dirbama

`memory/` yra gitignored, todėl jos nemato nė viena debesų sesija — nei iOS,
nei web. Ši sesija, rašanti šį dokumentą, Petriuko atminties **neturi**.
Vienintelis egzempliorius guli Mac'e, kuriame, pagal paties repo
`.claude/README.md`, yra **dvi to paties repo klonuotės** (`bomba.lt-tests` su
tašku ir `bomba-lt-tests` su brūkšneliu). Backupo nėra. Vienas `rm -rf`,
diskas arba naujas kompiuteris — ir atmintis dingo be pėdsakų.

Tai svarbiausia problema. Atmintis, kurios asistentas nemato pusėje savo
darbo vietų, nėra smegenys — tai užrašų knygelė stalčiuje.

### 2.2. Visa atmintis nubausta dėl 5% jos turinio

`memory/` iškrito iš git ne todėl, kad ten žinios slaptos, o todėl, kad tarp
žinių buvo secrets. Kaina — nepasiekiamumas iš debesų, jokio backupo, jokios
istorijos, jokio code review. Sprendimas paprastas: secrets iškelti, likusią
atmintį grąžinti į git. **Tai vienintelis pakeitimas, kuris atrakina visus
kitus lygius.**

Šalutinė pastaba, nesusijusi su atmintimi, bet rasta ieškant: viename projekto
`CLAUDE.md` yra kredencialų atviru tekstu. Privatus repo nėra saugykla — juos
reikia pasukti ir iškelti į `.env` / slaptažodžių saugyklą atskirai nuo šio
darbo. Konkretus failas ir kredencialų tipai čia neįvardijami sąmoningai:
**šis repo yra viešas**, ir tokia nuoroda būtų taikinio adresas.

### 2.3. Atmintis pririšta prie projekto, ne prie srities

`memory/` yra kiekviename repo atskirai. Bet Discogs kainodara, PVM
traktavimas, tiekėjų PPD ar klientų aptarnavimo tonas — tai **verslo**, ne
**repo** žinios. Dabar jos arba dubliuojasi, arba egzistuoja tik viename
projekte, o dirbant kitame — jų nėra.

5 lygis reikalauja skirstymo pagal sritis. Dabar skirstymas yra pagal
techninę saugyklą, o tai neatitinka to, kaip klausimai užduodami realiai.

### 2.4. Du failai — tai ne struktūra, o krūva

`MEMORY.md` + `MASTER_MEMORY.md` yra dviejų failų sistema. „MASTER" failas
pagal apibrėžimą auga be ribos, jo niekas nekarpo, o asistentas jį skaito
arba visą, arba nieko. Trūksta atomiškumo: negalima paimti vieno fakto,
nepasiimant viso konteksto kartu.

### 2.5. Nėra šviežumo mechanizmo

`muzikosirasai/CLAUDE.md` tvirtina „Testų statusas (2026-04-13) — 198/201" ir
„Lojalumo sistema (2026-04-10) — DEPLOYED". Gal ir tiesa, gal ne — po keturių
mėnesių to niekas nepatikrino, ir niekas nepatikrins, nes nėra nieko, kas
pasakytų, kad eilutė pasenusi. Asistentas tokį faktą atkartos su tuo pačiu
pasitikėjimu kaip ir vakar įrašytą.

Video mini linting (⁠[06:51]⁠) būtent dėl to — be jo atmintis lėtai virsta
melu, ir tai pavojingiau nei tuščia atmintis.

### 2.6. Disbalansas: procedūros keliauja, faktai — ne

33 skills jau sinchronizuojasi per akauntą ir veikia kiekvienoje aplinkoje,
įskaitant šią. Faktinė atmintis — ne. Procedūrinė smegenų pusė jau 6 lygyje,
faktinė tebėra 3-iame. Tą patį sinchronizavimo principą reikia pritaikyti ir
faktams.

---

## 3. 5 lygis — Antrosios smegenys

### 3.1. Atskiras repo, ne pakatalogis

Sukurti privatų `petriuko-atmintis` repo. Ne `imuzika-ops` viduje — atmintis
apima abu projektus, parduotuvę, buhalteriją ir tiekėjus, todėl negali gyventi
viename iš jų.

```
petriuko-atmintis/
  README.md              # kaip naudotis — max 20 eilučių
  INDEX.md               # GENERUOJAMAS skriptu, ne rašomas ranka
  sritys/
    pardavimai/          # kanalai, maržos, sezoniškumas
    tiekejai/            # Bertus, Warner, Universal, PPD, dilerinės
    discogs/             # inventorius, kainodara, ginčai
    ebay/                # MUSIC SHOP LONDON, listingai, VAT
    buhalterija/         # PVM pagal kanalą, SF serijos, kasa
    klientai/            # tonas, tipiniai atvejai, grąžinimai
    it-infra/            # serveriai, PrestaShop, Laravel, sesijos
    marketing/           # kampanijos, naujienlaiškiai, UTM
  sprendimai/            # ADR: kodėl nusprendėm taip, su data
  faktai/                # atomai: vienas faktas + data + šaltinis
  inbox/                 # agentų nauda, dar nepatvirtinta (žr. 4 sk.)
  archyvas/              # nebeaktualu, bet istorija išsaugota
```

### 3.2. Vienas failas = viena tema, max ~200 eilučių

Peraugęs failas skyla, o ne toliau auga. Tai vienintelė taisyklė, kuri
neleidžia atsirasti antram `MASTER_MEMORY.md`.

### 3.3. Frontmatter kiekvieno failo viršuje

```yaml
---
sritis: tiekejai
atnaujinta: 2026-08-17
galioja-iki: 2026-11-17        # po šios datos linteris rėkia
saltinis: Bertus 2026 dilerių kainynas (Gmail, 2026-08-12)
tikrumas: patvirtinta          # patvirtinta | juodrastis | spėjimas
---
```

`tikrumas` laukas svarbesnis, nei atrodo. Jis leidžia asistentui atsakyti
„pagal juodraštinį įrašą..." vietoj to, kad spėjimą pateiktų kaip faktą.
`galioja-iki` skirtingoms sritims skiriasi: PVM tarifas — metai, tiekėjo
kainynas — ketvirtis, testų statusas — mėnuo.

### 3.4. Secrets — niekada čia

Atmintyje lieka tik nuoroda:

```md
SSH į `<serveris>` — slaptažodis saugyklos įraše `<įrašo vardas>`.
```

Tada visas repo gali būti git'e, ir tada jis pasiekiamas iš iOS, web ir
Desktop vienodai.

### 3.5. Linteris (video ⁠[06:51]⁠)

Skriptas `lint.mjs`, paleidžiamas per pre-commit hook **ir** GitHub Action:

| Tikrina | Veiksmas |
|---|---|
| Failas be `atnaujinta` / `galioja-iki` | klaida |
| `galioja-iki` praėjusi | įspėjimas → savaitinė ataskaita |
| Failas > 200 eilučių | klaida (laikas skelti) |
| Nuoroda į neegzistuojantį failą | klaida |
| Dublikatas (normalizuoto sakinio hash sutampa 2 failuose) | įspėjimas |
| Secrets regex (slaptažodžiai, API raktai, `sshpass -p`) | **blokuoja commitą** |

Paskutinė eilutė yra tai, kas leidžia saugiai grąžinti atmintį į git ir
neleisti istorijai pasikartoti.

### 3.6. CLAUDE.md tampa plonu rodykliu

Kiekviename projekte `CLAUDE.md` lieka tik projekto taisyklės (serveris, PHP
versija, darbo eiga) plius nuoroda į atminties repo. Žinios iš jo išsikelia.
Šiandien `muzikosirasai/CLAUDE.md` yra 5 KB, iš kurių didesnė dalis — verslo
statusas, kuriam ten ne vieta.

Tas pats galioja ir `bomba-lt-tests/.claude/README.md`: sesijų mechanikos
žinios (kad `waiting` sesija eilės nedrenuoja, kad `disconnected` gali
neatsigauti, kad symlink lūžo 2026-08-15) yra brangiai užsidirbtos operacinės
žinios, atsitiktinai atsidūrusios test repo README'e. Jų vieta —
`sritys/it-infra/claude-sesijos.md`.

---

## 4. 6 lygis — Konteksto rinkimas

Infrastruktūra jau yra: Routines (`create_trigger`), `/sesijos`, MCP jungtys
(Gmail, Drive, Discogs, GitHub). Trūksta vieno — kad agento darbo rezultatas
**nusėstų į atmintį**, o ne liktų pokalbyje, kurį po savaitės niekas neatidarys.

### 4.1. Kombainai

Kiekvienas — Routine su `create_new_session_on_fire: true`, kuris baigia darbą
commitu į `petriuko-atmintis`:

| Kada | Ką surenka | Kur rašo |
|---|---|---|
| Kasdien 07:00 | Discogs užsakymai, nauji listingai, kainų pokyčiai | `inbox/discogs/` |
| Pirmadieniais | Savaitės pardavimų suvestinė iš PrestaShop | `inbox/pardavimai/` |
| Atėjus tiekėjo kainynui į Gmail | PPD pokyčiai vs. praėjęs kainynas | `inbox/tiekejai/` |
| Po kampanijos (7 d.) | Rezultatai pagal `kampanijos-planas` skill | `inbox/marketing/` |
| Šeštadieniais | Linterio ataskaita: kas pasenę, kas dubliuojasi | push notification |

### 4.2. Svarbiausia šio lygio taisyklė

**Agentas rašo į `inbox/`, niekada tiesiai į `sritys/`.** Patvirtinimas
(tavo arba antro agento) perkelia įrašą į sritį ir pakeičia `tikrumas:
juodrastis` → `patvirtinta`.

Be šito po mėnesio atmintis prisipildo automatiškai sugeneruoto šlamšto, o
atmintis, kuria nebepasitiki, yra blogiau nei jokios atminties — nes ja vis
tiek naudojiesi.

### 4.3. Kiekvienas įrašas su šaltiniu

`saltinis:` laukas privalomas ir agentams. Kai po pusmečio kils klausimas
„iš kur mes tai žinom", atsakymas turi būti faile, o ne prisiminimuose.

---

## 5. 7 lygis — Įmonės smegenys

Čia rekomendacija priešinga video eigai: **PostgreSQL + embeddings dabar būtų
klaida.** Priežastys konkrečios:

1. **Mastelis netinka.** Vektorinė paieška pradeda laimėti prieš `grep` maždaug
   nuo kelių šimtų failų. Realiai atminties bus 100–300 md failų. `grep` per
   juos veikia greičiau, tiksliau ir be indeksavimo vėlavimo.
2. **Klausimų tipas netinka.** PVM tarifas, katalogo numeris, PPD kaina,
   SF serija — tai **tikslūs** faktai. Vektorinė paieška grąžina *panašius*
   rezultatus, o panašus PVM tarifas yra neteisingas PVM tarifas.
3. **Permissions dar neturi ką saugoti.** Prieigos teisių sluoksnis reikalingas,
   kai yra komanda, kuri turi matyti dalį, bet ne viską. Kol skaitytojas vienas,
   tai grynas kompleksiškumas be naudos.

### 5.1. Ką daryti vietoj to

MCP serveris virš `petriuko-atmintis` repo. Patirtis jau yra —
`mcp-server-images-inspector` repo rodo, kad MCP rašymas nėra kliūtis.

Įrankiai: `atmintis_ieskoti` (grep + frontmatter filtrai), `atmintis_skaityti`,
`atmintis_rasyti` (visada į `inbox/`), `atmintis_pasene` (ką linteris pažymėjo).

Nauda — atmintis pasiekiama iš Claude Desktop, iOS ir web vienodai, be
klonavimo ir be to, kad kiekviena sesija skaitytų visą repo.

### 5.2. Kada iš tikrųjų pereiti į 7 lygį

Kai bent vienas iš trijų:

- atsiranda antras žmogus, kuriam reikia matyti dalį, bet ne viską;
- failų daugiau nei ~500;
- reikia atsakyti į klausimus, apimančius 20+ failų vienu metu.

Ir tada — md failai lieka SSOT, o Postgres yra **tik indeksas**, kurį galima
bet kada ištrinti ir perstatyti iš failų. Niekada atvirkščiai.

---

## 6. Ką daryti pirmiausia

| # | Darbas | Trukmė | Kodėl toks eiliškumas |
|---|---|---|---|
| 1 | Projekto `CLAUDE.md` kredencialus pasukti ir iškelti | 1 val. | Nesusiję su atmintimi, bet atviru tekstu git'e |
| 2 | `petriuko-atmintis` repo + struktūra + secrets iškėlimas iš `memory/` | 0,5 d. | Be šito niekas kitas neveikia |
| 3 | `MASTER_MEMORY.md` išskaidyti į sritis su frontmatter | 0,5 d. | Vienkartinis darbas, toliau tik palaikymas |
| 4 | Linteris + pre-commit + GH Action | 0,5 d. | Apsauga, kad #2 nepasikartotų |
| 5 | Abiejų projektų `CLAUDE.md` → plonas rodyklis | 1 val. | Panaikina dubliavimą |
| 6 | 2 kombainai (Discogs kasdien, pardavimai savaitėmis) su `inbox/` | 1 d. | 6 lygis, pradedant nuo dviejų, ne penkių |
| 7 | MCP serveris virš atminties | 1–2 d. | Kai struktūra jau nusistovėjusi |

Po #2–#4 atmintis jau yra tikros antrosios smegenys: pasiekiamos visur, su
backupu, istorija ir šviežumo kontrole. Viskas toliau — pagerinimai, ne
pamatas.

---

## 7. Kas jau padaryta

Žingsniai #2, #4 ir #5 nebėra planas — [`atmintis-starter/`](../atmintis-starter/)
yra veikiantis karkasas, paruoštas perkelti į naują repo vienu `cp -r`.

| Kas | Kur |
|---|---|
| Katalogų struktūra pagal sritis | `atmintis-starter/sritys/` + [`GAIRES.md`](../atmintis-starter/sritys/GAIRES.md) |
| Linteris (secrets, pasenę, ilgis, dublikatai, nuorodos) | [`scripts/lint.mjs`](../atmintis-starter/scripts/lint.mjs) |
| Linterio testai — 19 atvejų | [`scripts/test.mjs`](../atmintis-starter/scripts/test.mjs) |
| `INDEX.md` generatorius | [`scripts/index.mjs`](../atmintis-starter/scripts/index.mjs) |
| Pre-commit hook + GitHub Action | `hooks/pre-commit`, `github/atmintis.yml` |
| Šablonai: faktas, ADR, plonas `CLAUDE.md` | `atmintis-starter/templates/` |
| Kombainų promptai (6 lygis) | [`routines/KOMBAINAI.md`](../atmintis-starter/routines/KOMBAINAI.md) |
| Pirmas tikras įrašas — sesijų mechanika | [`sritys/it-infra/claude-sesijos.md`](../atmintis-starter/sritys/it-infra/claude-sesijos.md) |

Karkasas guli šiame repo, o ne savo — šiai sesijai naujų GitHub repo kurti
neleista (patikrinta: `create_repository` grąžina 403). Perkėlimo komandos:
[`atmintis-starter/README.md`](../atmintis-starter/README.md).

> **⚠️ `bomba-lt-tests` yra viešas repo.** Todėl karkase yra tik struktūra,
> įrankiai ir šablonai — jokių verslo faktų: nei tiekėjų dilerinių nuolaidų,
> nei sąskaitų plano, nei klientų kodų, nei kasos numerių. Jie keliauja
> tiesiai į **privatų** `petriuko-atmintis`, aplenkdami šį repo.
>
> Tai ne smulkmena, o atskiras reikalavimas visam planui: atmintis, kurioje
> yra tiekėjų kainodara ir apskaitos struktūra, viešame repo neturi ką veikti.
> Kuriant repo — `private: true` nuo pirmos sekundės, ne po to.

Liko tavo pusėje: #1 (slaptažodžių pasukimas), #3 (`MASTER_MEMORY.md`
skaidymas — reikia Mac'o, nes failas nepasiekiamas iš debesų) ir #6–#7.

---

## 8. Ko šis dokumentas nematė

`memory/MEMORY.md` ir `memory/MASTER_MEMORY.md` turinys šiam vertinimui buvo
nepasiekiamas — jie gitignored, todėl debesų sesija jų nemato (kas ir yra
2.1 punkto įrodymas). Analizė remiasi struktūra, `CLAUDE.md` nuorodomis ir
`.gitignore` istorija. Konkretus skaidymo į sritis planas (#3 punktas) taps
tikslesnis, kai failai bus matomi — Mac'o sesijoje arba juos perkėlus į git.
