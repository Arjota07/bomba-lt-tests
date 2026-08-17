# atmintis-starter

Veikiantis `petriuko-atmintis` repo karkasas: struktūra, linteris, indekso
generatorius, hook'ai, šablonai ir kombainų promptai.

Kodėl jis guli **čia**, o ne savo repo: šiai sesijai naujų GitHub repo kurti
neleista. Karkasas paruoštas taip, kad perkėlimas būtų vienas `cp -r`.

Pagrindimas ir analizė — [`docs/petriuko-atmintis-planas.md`](../docs/petriuko-atmintis-planas.md).

## Perkėlimas į naują repo

```bash
# 1. Naujas privatus repo GitHub'e: petriuko-atmintis

# 2. Karkasas iš čia
git -C ~/Projektai/bomba.lt-tests pull
mkdir -p ~/Projektai/petriuko-atmintis
cp -r ~/Projektai/bomba.lt-tests/atmintis-starter/. ~/Projektai/petriuko-atmintis/
cd ~/Projektai/petriuko-atmintis

# 3. GH Action į vietą (čia jis po github/, kad nepasileistų svetimame repo)
mkdir -p .github/workflows
mv github/atmintis.yml .github/workflows/atmintis.yml
rmdir github

# 4. Hook'ai ir pirmas patikrinimas
npm run hooks
npm run tikrinti
npm run indeksas

# 5. Į git
git init && git add -A
git commit -m "Petriuko atmintis: pradinis karkasas"
git remote add origin git@github.com:Arjota07/petriuko-atmintis.git
git push -u origin main
```

## Kasdienis naudojimas

```bash
npm run tikrinti     # linteris: secrets, pasenę, per ilgi, dublikatai, nuorodos
npm run indeksas     # perrašo INDEX.md iš frontmatter
npm test             # 19 linterio testų — ar jis dar gaudo tai, ką turi
```

Pre-commit hook abu paleidžia automatiškai, o pasenusį `INDEX.md` atnaujina ir
įtraukia į commitą pats.

## Ką linteris blokuoja

| Kodas | Ką reiškia |
|---|---|
| `SECRET/*` | kredencialas atmintyje — vietoj reikšmės turi būti nuoroda į saugyklą |
| `FM/nera`, `FM/laukas` | trūksta frontmatter arba privalomo lauko |
| `FM/data` | bloga data arba `galioja-iki` ne vėlesnė už `atnaujinta` |
| `FM/tikrumas` | `tikrumas` ne iš sąrašo: `patvirtinta`, `juodrastis`, `spejimas` |
| `INBOX/tikrumas` | `inbox/` įrašas ne `juodrastis` — patvirtinimas praleistas |
| `ILGIS` | virš 200 eilučių — laikas skelti |
| `NUORODA` | nuoroda į neegzistuojantį failą |

Įspėja (neblokuoja): `PASENE` — `galioja-iki` praėjusi; `DUBLIKATAS` — tas pats
teiginys dviejuose failuose; `GALIMAS-SECRET` — prisijungimų eilutėje yra
reikšmė, atrodanti kaip slaptažodis.

`GALIMAS-SECRET` egzistuoja dėl konkretaus atvejo: `muzikosirasai/CLAUDE.md`
eilutė `**Admin:** <url> / <vartotojas> / <slaptažodis>` neturi žodžio
„password", todėl griežtieji šablonai jos nepagauna. Tai heuristika, ne
garantija — ji gali ir klysti, ir praleisti. **Linteris nepakeičia to, kad
kredencialų į atmintį tiesiog nerašai.**

`npm run tikrinti:strict` paverčia įspėjimus klaidomis. CI naudoja paprastą
režimą, kad pasenęs faktas neblokuotų nesusijusio commito.

## Kas čia yra

```
scripts/lint.mjs        linteris (be priklausomybių)
scripts/index.mjs       INDEX.md generatorius
scripts/test.mjs        linterio testai — 19 atvejų
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
