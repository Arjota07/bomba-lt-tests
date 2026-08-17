# atmintis-starter

Veikiantis `petriuko-atmintis` repo karkasas: struktūra, linteris, indekso
generatorius, hook'ai, šablonai ir kombainų promptai.

Kodėl jis guli **čia**, o ne savo repo: šiai sesijai naujų GitHub repo kurti
neleista. Karkasas paruoštas taip, kad perkėlimas būtų vienas `cp -r`.

Pagrindimas ir analizė — [`docs/petriuko-atmintis-planas.md`](https://github.com/Arjota07/bomba-lt-tests/blob/master/docs/petriuko-atmintis-planas.md)
(nuoroda pilna, o ne santykinė, nes po `cp -r` į kitą repo santykinė lūžtų).

## Perkėlimas į naują repo

```bash
# 1. Naujas PRIVATUS repo (be --private nedaryk — čia eis tiekėjų kainodara
#    ir apskaitos struktūra)
gh repo create Arjota07/petriuko-atmintis --private
#    Neturint gh — sukurk per github.com, pažymėjęs „Private", be README.

# 2. Karkasas iš čia. DĖMESIO: jis kol kas gyvena šakoje, ne master'yje.
cd ~/Projektai/bomba.lt-tests
git fetch origin claude/petriuko-atmintis-asistentui-u2n1jx
git checkout claude/petriuko-atmintis-asistentui-u2n1jx
mkdir -p ~/Projektai/petriuko-atmintis
cp -r ~/Projektai/bomba.lt-tests/atmintis-starter/. ~/Projektai/petriuko-atmintis/
cd ~/Projektai/petriuko-atmintis

# 3. GH Action į vietą (čia jis po github/, kad nepasileistų svetimame repo)
mkdir -p .github/workflows
mv github/atmintis.yml .github/workflows/atmintis.yml
rm -rf github   # rm, ne rmdir: Finder palieka .DS_Store

# 4. Į git (git init PRIEŠ npm run hooks — hooks rašo į git konfigą)
git init -b main
npm run hooks

# 5. PATIKRINK, ar hook'as tikrai įsijungė — be šito 6 žingsnis rodytų žalią
#    net tuo atveju, jei apsaugos nėra
test "$(git config core.hooksPath)" = "hooks" && echo "hook'as veikia" || echo "HOOK'O NĖRA"

# 6. Pirmas patikrinimas
npm test
npm run tikrinti
npm run indeksas

# 7. Pirmas commitas
git add -A
git commit -m "Petriuko atmintis: pradinis karkasas"
git remote add origin git@github.com:Arjota07/petriuko-atmintis.git
git push -u origin main
```

Toliau — [`routines/MIGRACIJA.md`](routines/MIGRACIJA.md): promptas Mac'o sesijai,
kuri išskaido senąjį `MASTER_MEMORY.md` į sritis.

## Kasdienis naudojimas

```bash
npm run tikrinti     # linteris: secrets, pasenę, per ilgi, dublikatai, nuorodos
npm run indeksas     # perrašo INDEX.md iš frontmatter
npm test             # 37 linterio testų — ar jis dar gaudo tai, ką turi
```

Pre-commit hook abu paleidžia automatiškai, o pasenusį `INDEX.md` atnaujina ir
įtraukia į commitą pats. Jis tikrina **indeksą** (tai, kas commitinama), ne
darbinį katalogą — kitaip jau `git add`-intas kredencialas praeitų, jei tuo metu
darbiniame kataloge jo nebėra.

> **`core.hooksPath` per `git clone` nepersikelia.** Tai lokalus repo konfigas.
> Kiekvienoje naujoje klonuotėje — ir kiekvienoje naujoje mašinoje — reikia iš
> naujo paleisti `npm run hooks`, kitaip apsaugos nėra ir niekas apie tai
> nepraneša. Vienintelė patikra, kuri veikia visur, yra GitHub Action.

## Ką linteris blokuoja

| Kodas | Ką reiškia |
|---|---|
| `SECRET/sshpass`, `/gh-token`, `/stripe`, `/aws`, `/bearer`, `/basic-auth`, `/url-creds`, `/private-key` | atpažįstamos formos raktas ar slaptažodis |
| `SECRET/reiksme` | raktažodis su reikšme (`slaptažodis: <reikšmė>`) |
| `SECRET/lentele` | kredencialas markdown lentelės langelyje |
| `SECRET/be-raktazodzio` | prisijungimų eilutėje reikšmė, atrodanti kaip slaptažodis |
| `FM/nera`, `FM/laukas` | trūksta frontmatter arba privalomo lauko |
| `FM/data` | bloga data arba `galioja-iki` ne vėlesnė už `atnaujinta` |
| `FM/tikrumas` | `tikrumas` ne iš sąrašo: `patvirtinta`, `juodrastis`, `spejimas` |
| `INBOX/tikrumas` | `inbox/` įrašas ne `juodrastis` — patvirtinimas praleistas |
| `ILGIS` | virš 200 eilučių teksto (lentelės neskaičiuojamos) |
| `NUORODA` | nuoroda į neegzistuojantį failą |

Įspėja (neblokuoja): `PASENE` — `galioja-iki` praėjusi; `DUBLIKATAS` — tas pats
teiginys dviejuose failuose.

**Kredencialai ieškomi VISUOSE repo tekstiniuose failuose**, ne tik atminties
kataloguose — slaptažodis `README.md`, `routines/` ar `.txt` faile yra lygiai
taip pat nutekėjęs. Struktūros taisyklės (frontmatter, ilgis, nuorodos) taikomos
tik `sritys/`, `faktai/`, `sprendimai/`, `inbox/`, `archyvas/`.

Nuorodų formos praeina: `1Password`, `op://`, `${KINTAMASIS}`, `$VAR`,
`<vietaženklis>`, `.env`. Klaidingai pažymėtą eilutę galima nutildyti komentaru
`<!-- lint:ne-secret -->` — jis galioja tik tai eilutei ir tik kredencialų
taisyklėms.

**Linteris nepakeičia to, kad kredencialų į atmintį tiesiog nerašai.** Jis yra
tinklas po lynu, o ne lynas.

### Kodėl `SECRET/be-raktazodzio` blokuoja, o ne įspėja

Pirmoje versijoje jis buvo tik įspėjimas. Kadangi nei pre-commit hook'as, nei CI
nenaudoja `--strict`, tai reiškė, kad jis **niekada nieko neblokavo** — forma
`**Admin:** <url> / <vartotojas> / <slaptažodis>`, dėl kurios jis ir buvo
sukurtas, praeidavo į git tyliai. Dabar blokuoja, o klaidingiems atvejams yra
nutildymo komentaras.

`npm run tikrinti:strict` paverčia įspėjimus klaidomis. CI naudoja paprastą
režimą, kad pasenęs faktas neblokuotų nesusijusio commito.

## Kas čia yra

```
scripts/lint.mjs        linteris (be priklausomybių)
scripts/index.mjs       INDEX.md generatorius
scripts/test.mjs        linterio testai — 37 atvejai
sritys/                 žinios pagal sritis — GAIRES.md sako, kas kur
sprendimai/             ADR: kodėl nusprendėm taip
faktai/                 atskiri atomai, netelpantys į sritį
inbox/                  kombainų nauda, laukianti patvirtinimo
archyvas/               nebeaktualu, bet istorija lieka
templates/              faktas.md, sprendimas.md, CLAUDE.md rodyklis
hooks/pre-commit        linteris + indeksas prieš kiekvieną commitą
github/atmintis.yml     GH Action (perkelti į .github/workflows/)
routines/KOMBAINAI.md   6 lygio agentų promptai
```

## Ko čia NĖRA ir nebus

Kredencialų. Nė vieno. Atmintis laiko tik nuorodą:

> SSH į `<serveris>` — slaptažodis 1Password įraše `<įrašo vardas>`.

Būtent dėl kredencialų senoji `memory/` iškrito iš git ir liko be backupo
vienoje mašinoje. Linteris egzistuoja tam, kad tai nepasikartotų.
