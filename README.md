# imuzika.lt E2E tests

E2E tests for **imuzika.lt** ([www.imuzika.lt](https://www.imuzika.lt), PrestaShop 9.1.1) — read-only smoke + visual regression against production.

> **Post-cutover (2026-05-26):** production = `https://www.imuzika.lt`. The `bomba.lt` domain now 302-redirects to it (retired-brand stub — covered by `smoke/redirect-health.spec.ts`). The GitHub repo slug is still `bomba-lt-tests`.

## ⚠️ MODE: PROD READ-ONLY

This suite tests **production** (`https://www.imuzika.lt`) and:

- ✅ Browses public pages
- ✅ Captures visual regression baseline
- ✅ Validates 200 responses + console errors
- ❌ NEVER registers users, NEVER submits forms, NEVER places orders
- ❌ NEVER touches admin (`admin.bomba.lt`)
- ❌ NEVER tests destructive flows

For destructive testing → use a separate staging environment.

## Setup

```bash
cd ~/Projektai/bomba.lt-tests
npm install
npx playwright install --with-deps chromium webkit
```

## Run

```bash
# Visi smoke testai
npm run test:smoke

# Visual regression (po baseline'o sukūrimo)
npm run test:visual

# Headed mode (matomas browser) debugging'ui
npm run test:debug

# Update visual regression baseline (po legitimaus dizaino keitimo)
npm run test:update-snapshots

# Konkretus testas
npx playwright test homepage --headed

# Konkretus device
npx playwright test --project=mobile-iphone
```

## Override base URL

```bash
# Staging arba dev environment
BASE_URL=https://dev.bomba.lt npm test

# Lokalus PHP build (jei kada nors atsiras)
BASE_URL=http://localhost:8000 npm test
```

## Test struktūra

```
tests/e2e/
├── fixtures/
│   └── storage.ts                  # guestPage fixture
└── specs/
    ├── smoke/                      # TC-001..TC-005 (homepage, navigation)
    │   ├── homepage.spec.ts
    │   └── navigation.spec.ts
    ├── a11y/                       # WCAG 2.1 AA per axe-core
    │   └── homepage-a11y.spec.ts
    ├── security/                   # OWASP Secure Headers checks
    │   └── headers.spec.ts
    ├── mobile/                     # TC-MOB-*: mobile UX (touch targets, viewport)
    │   └── mobile-ux.spec.ts
    ├── performance/                # TC-PERF-*: TTFB, FCP, LCP, page weight
    │   └── web-vitals.spec.ts
    ├── checkout/                   # TC-CHK-*: cart/login/checkout flows (read-only)
    │   └── cart-flows.spec.ts
    └── visual/                     # Visual regression — cross-device + cross-OS
        ├── homepage-baseline.spec.ts
        └── homepage-baseline.spec.ts-snapshots/
            ├── homepage-atf-desktop-chromium-darwin.png    # Mac local
            ├── homepage-atf-desktop-chromium-linux.png     # CI runner
            └── ...
```

## CI integration

GitHub Actions workflow: [`.github/workflows/e2e-bomba.yml`](.github/workflows/e2e-bomba.yml).

**Trigger'iai (po 2026-05-25 billing minimization):**
- `push` į master/main (paths-filtered) → 4 jobs (smoke+security+a11y+checkout × desktop-chromium)
- `pull_request` → 1 job (smoke × desktop-chromium) sanity check
- `schedule` (weekly Monday 06:00 UTC) → 3 jobs drift detection
- `workflow_dispatch` su `qa_suite` input → pilna matrica (11 jobs) arba single dimension

**Tech stack:**
- `actions/checkout@v6`, `actions/setup-node@v6`, `actions/cache@v5`, `actions/upload-artifact@v7` (Node 24 ready)
- Node 20 runtime
- Playwright 1.60+ (palaiko `--update-snapshots=missing` granular flag)
- `concurrency: cancel-in-progress` — newer push cancels older
- `timeout-minutes: 10` per job

**Free tier biudžetas (PUBLIC repo = unlimited free):**
- Typical mėn: <200 min naudojimo
- Repo'as **PUBLIC** (paverstas 2026-05-25 po billing failure incident'o) → GitHub Actions nemokamos unlimited

Manual full matrica:
```bash
gh workflow run "imuzika.lt E2E (Production Monitor)" --ref master -f qa_suite=all
```

## Visual regression baselines — cross-OS

Snapshots'ai turi OS sufiksą faile vardo (`*-darwin.png`, `*-linux.png`). Playwright AUTO pasirenka pagal `process.platform`:

| Platform | Naudojama baseline'ui | Kada |
|---|---|---|
| `darwin` (Mac) | `*-darwin.png` | Lokalus dev su `npm test` |
| `linux` | `*-linux.png` | GitHub Actions CI runner |
| `win32` | `*-win32.png` | (nenaudojama) |

**Iki kol abu egzistuoja repo'e — visual regression veikia cross-OS.** Vienos OS baseline neveikia kitoje OS dėl skirtingo font rendering, anti-aliasing, GPU/CPU rasterization.

### Kaip regeneruoti baseline'us po dizaino keitimų

**Mac (local):**
```bash
npm run test:update-snapshots                  # update VISŲ snapshots
npx playwright test specs/visual --update-snapshots=missing  # tik missing
git add tests/e2e/specs/visual/**/*-darwin.png
git commit -m "test(visual): update darwin baselines"
```

**Linux CI (oficialiu būdu — sukurti per workflow):**
1. Paleisti workflow su visual input:
   ```bash
   gh workflow run "imuzika.lt E2E (Production Monitor)" --ref master -f qa_suite=visual
   ```
2. Po run'o (FAIL su "snapshot doesn't exist" — tai expected pirmu kartu):
   ```bash
   RUN_ID=$(gh run list --workflow=e2e-bomba.yml --limit 1 --json databaseId --jq '.[0].databaseId')
   mkdir -p /tmp/visual-snapshots-$RUN_ID
   cd /tmp/visual-snapshots-$RUN_ID
   gh run download $RUN_ID --name visual-snapshots-linux
   cp tests/e2e/specs/visual/homepage-baseline.spec.ts-snapshots/*-linux.png \
      ~/Projektai/bomba-lt-tests/tests/e2e/specs/visual/homepage-baseline.spec.ts-snapshots/
   cd ~/Projektai/bomba-lt-tests
   git add tests/e2e/specs/visual/**/*-linux.png
   git commit -m "test(visual): update linux baselines"
   git push  # jei PNG'ai dideli — pirma: git config http.postBuffer 524288000
   ```
3. Antrasis CI run jau lygins prieš naujus baseline'us → PASS.

### Žinomi cross-OS limitations
- Šiuo metu **TIK desktop-chromium-linux baseline'as commit'intas** repo'e — `mobile-iphone-linux` ir `tablet-ipad-linux` reikia regeneruoti tuo pačiu metodu kai bus reikalingi.
- Workflow visual job apriboja `--project=desktop-chromium` kol kiti baseline'ai nebus pridėti.

## /daryk-e2e integration

This project is consumed by the `e2e-orchestrator` skill:

```
"daryk e2e ant bomba.lt"
→ Skill detects this directory
→ Sets MODE=prod (auto, since bomba.lt is production-only)
→ Runs Smoke + Visual + UX + Performance + Security
→ Skips Adversarial + destructive cases
→ Generates report at /tmp/e2e-report-bomba-*.md
```

## Žinomi limitations

- **Cookie consent** — auto-accept'inamas fixtų atveju. Jei dizainas keičiasi — `storage.ts:13` selectoras gali sulūžti.
- **CAPTCHA** — jeigu Cloudflare WAF užkertų ant CI runner'ių IP — gali reikti add `BASE_URL=https://staging.bomba.lt` arba allow-list IP.
- **Locale** — testai LT/EN agnostic (`/sutinku|accept|patvirtinti/i` regex'ai).

## Susiję

- Main skill: `~/.claude/skills/e2e-orchestrator/` (v1.0.3+ su KRITINĖ TAISYKLĖ #11: self-hosted runner DA shared hosting'e NEĮMANOMAS)
- Production target: https://www.imuzika.lt
- Server: bomba.hostingas.lt (109.235.68.43)
- Billing incident memory: `project_github_actions_billing_20260525.md` (paaiškina kodėl repo PUBLIC ir self-hosted runner nebandytinas)
- DO NOT push tests dir to production server.
