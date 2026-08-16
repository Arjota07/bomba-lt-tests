# Claude Code skill'ai šiam projektui

Projekto lygio skill'ai (`.claude/skills/`), parinkti iš skills.sh topo pagal iMuzika
testų/monitoringo repo poreikius. Diegta per `npx skills add ... --copy` (failai
commitinti, ne symlink'ai), versijos fiksuotos `skills-lock.json`.

## Įdiegta (6 + 2 priklausomybės)

| Skill | Šaltinis | Kam čia reikalingas |
|---|---|---|
| `agent-browser` | vercel-labs/agent-browser | Interaktyvus naršyklės valdymas: gyvų puslapių tikrinimas, testų failure'ų atkartojimas, exploratory QA šalia Playwright |
| `tdd` | mattpocock/skills | Red→green disciplina rašant naujus spec'us — šio repo pagrindinė veikla |
| `triage` | mattpocock/skills | Monitoringo alertų / bug report'ų rūšiavimas pagal svarbą į agent-ready briefus |
| `grill-me` | mattpocock/skills | Griežtas planų „iškepimas" prieš naujus testų suite'us ar integracijas |
| `grill-with-docs` | mattpocock/skills | Tas pats + ADR/glossary dokumentai eigoje |
| `find-skills` | vercel-labs/skills | Naujų skill'ų paieška registre (`npx skills find <query>`) |
| `grilling` | mattpocock/skills | **Priklausomybė** — grill-me/grill-with-docs/triage variklis |
| `domain-modeling` | mattpocock/skills | **Priklausomybė** — reikalinga grill-with-docs |

## Sąmoningai praleista iš topo

- **Handoff** — dubliuotų iMuzika workflow checkpoint/WORK_STATE.md sistemą.
- **Setup Matt Pocock Skills** (bundle) — diegiam pavieniui; bundle įtrauktų nereikalingus.
- **Vercel React Best Practices** — repo be React (Playwright TS; parduotuvės — Smarty/Liquid).
- **Front-End Design** — testų repo nekuria UI; storefront dizainą dengia `music-taste` skill'as.
- **Lark Doc** — Lark/Feishu stack'e nenaudojamas (Gmail/Drive).

## Naudojimas

- `agent-browser`: aktyvuojasi automatiškai; sandbox'e be interneto naudoti
  `--executable-path /opt/pw-browsers/chromium` ir `file://` puslapius (išoriniai
  saitai ten blokuojami proxy — testuoti gyvą saitą tik lokalioje mašinoje / CI).
- `grill-me` / `grill-with-docs` / `triage`: kviesti per Skill tool arba `/grill-me`.
- Nauji skill'ai: `npx skills find <tema>` → `npx skills add <owner/repo> -s <name> -a claude-code --copy -y`.
- Atnaujinimas: `npx skills update` (hash'ai — `skills-lock.json`).

## Patikra (atlikta 2026-08-16)

1. Visų 8 SKILL.md frontmatter validus (name = katalogo vardas, description yra).
2. Saugumo skenas — be pavojingų komandų / kredencialų prieigos.
3. `npx skills ls` mato visus 8 kaip project skills.
4. `agent-browser` funkcinis testas: open → snapshot (a11y refs) → click → get text ✅.
5. `skills find` registro API pasiekiamas ✅.
