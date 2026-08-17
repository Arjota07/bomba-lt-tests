---
sritis: meta
atnaujinta: 2026-08-17
galioja-iki: 2027-02-17
saltinis: 33 synced skills peržiūra 2026-08-17
tikrumas: patvirtinta
---

# Skill'ai laiko procedūrą, atmintis — faktus

**Būsena:** priimta, įgyvendinimas atidėtas · **Data:** 2026-08-17

## Kontekstas

Peržiūrėjus synced skill'us matyti, kad juose sumaišyti du skirtingo gyvenimo
trukmės dalykai:

- **Procedūra** — kaip priimti sprendimą. Keičiasi retai, ir kai keičiasi, tai
  sąmoningas sprendimas.
- **Faktai** — konkretūs skaičiai, kodai ir sąrašai, kuriais ta procedūra
  remiasi. Keičiasi be tavo dalyvavimo: tiekėjas pakeičia sąlygas, apskaita
  perkelia kanalą, atsiranda nauja serija.

Faktams skill'o formatas netinka dėl trijų priežasčių:

1. **Nėra datos.** Skill'e įrašytas skaičius atrodo vienodai patikimai ir kitą
   dieną, ir po metų. Būtent tai aprašyta plano 2.5 punkte.
2. **Nėra linterio.** Niekas nepasakys, kad tiekėjo sąlygos nepatikrintos
   ketvirtį.
3. **Dubliavimasis jau prasidėjęs.** Tos pačios kertinės taisyklės pažodžiui
   kartojasi bent dviejuose skill'uose. Kol jos dvi, jos sutampa; kai vieną
   pakeisi, sužinosi apie tai per neteisingą atsakymą.

## Sprendimas

Faktų SSOT yra atmintis. Skill'as aprašo, **kaip** skaičiuoti ir ko klausti, o
konkrečius skaičius pasiima iš atminties. Kertinės, per visus skill'us
kartojamos taisyklės gyvena viename atminties faile ir cituojamos nuoroda.

## Kodėl ne dabar

Skill'as negali perskaityti atminties repo — jis sinchronizuojamas per akauntą
ir dirba ten, kur repo klonuotės nėra. Nuoroda taps įmanoma tik atsiradus
atminties MCP serveriui (plano #7 žingsnis).

Todėl eiliškumas toks:

1. Faktai surašomi į atmintį su datomis — atmintis tampa SSOT.
2. Skill'uose kol kas lieka kopija, o atminties faile pažymima, kad kopija yra
   ir kur. **Keičiant — keisti abu.** Tai sąmoninga laikina skola, ne aplaidumas.
3. Atsiradus MCP serveriui, skill'ų lentelės keičiamos į užklausą, ir kopijos
   dingsta.

## Pasekmės

- Tarpiniu laikotarpiu dubliavimasis padidėja, ne sumažėja. Mainais faktai
  įgyja datą ir peržiūros terminą — dabar jų neturi nė vienas.
- Atsiranda tvarkos matas, kurio anksčiau nebuvo: kiek skill'uose likę faktų,
  neturinčių atitikmens atmintyje.

## Kada peržiūrėti

Kai atminties MCP serveris pradės veikti — tada 3 žingsnis nustoja būti planu.
