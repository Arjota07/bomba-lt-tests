# bomba.lt-tests

E2E tests for [bomba.lt](https://bomba.lt) (PrestaShop 9.1.1) — read-only smoke + visual regression against production.

## ⚠️ MODE: PROD READ-ONLY

This suite tests **production** (`https://bomba.lt`) and:

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
│   └── storage.ts          # guestPage fixture su auto cookie accept
└── specs/
    ├── smoke/
    │   ├── homepage.spec.ts        # TC-001..TC-003
    │   └── navigation.spec.ts      # TC-004..TC-005
    └── visual/
        └── homepage-baseline.spec.ts  # cross-device screenshots
```

## CI integration

GitHub Actions workflow (`/.github/workflows/playwright.yml`):

```yaml
name: bomba.lt E2E

on:
  schedule:
    - cron: '0 6 * * *'  # kasdien 06:00 UTC
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

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

- Main skill: `~/.claude/skills/e2e-orchestrator/`
- Production target: https://bomba.lt
- Server: bomba.hostingas.lt (109.235.68.43)
- DO NOT push tests dir to production server.
