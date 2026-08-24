import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for imuzika.lt — PrestaShop 9.1.4
 *
 * 🔴 2026-05-26 cutover: bomba.lt 301→ www.imuzika.lt (tas pats PS9, failai
 * fiziškai domains/bomba.lt/public_html/). Kanoninis testų taikinys = imuzika.lt.
 * Absoliučių `https://bomba.lt/...` URL testuose NEBEBŪTI — jie apeina baseURL
 * ir prideda papildomą redirect hop'ą (2026-07-30 tai kėlė 429 rate-limit'ą).
 *
 * MODE: PRODUCTION READ-ONLY
 * - Tikrina tik publicus puslapius
 * - JOKIO checkout, JOKIO registracijos, JOKIO contact form submit
 * - Visual regression baseline'ai cross-device
 *
 * Run:
 *   npm test                 # all
 *   npm run test:smoke       # smoke only
 *   npm run test:visual      # visual regression
 *   BASE_URL=https://www.imuzika.lt npm test  # override URL
 */

// Post-cutover (2026-05-26): bomba.lt → 302 → www.imuzika.lt (path dropped to root).
// Production = www.imuzika.lt. bomba.lt domenas dabar tik redirect-stub'as.
const BASE_URL = process.env.BASE_URL || 'https://www.imuzika.lt';

export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // 🔴 2026-07-31: buvo `undefined` = ~pusė CPU branduolių (8 CPU → 4 workeriai).
  // Prieš PRODUCTION tai duodavo HTTP 429 checkout suite'e (ir „last status: 0"
  // nutrauktus requestus), t. y. monitorius pats gamindavo melagingą DRIFT'ą.
  // 2 workeriai = mandagus tempas prod'ui; perrašyti PW_WORKERS=4 lokaliai, jei reikia greičio.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 2,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['allure-playwright', {
      outputFolder: 'allure-results',
      detail: true,
      suiteTitle: false,
      environmentInfo: {
        target: BASE_URL,
        framework: 'PrestaShop 9.1.4',
        mode: 'production-read-only',
        node: process.version,
        os: process.platform,
      },
    }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Anti-flake — disable animations
    contextOptions: {
      reducedMotion: 'reduce',
    },

    // Headers (production etiquette)
    // X-Imuzika-E2E: CF WAF skip token (secrets.E2E_CF_TOKEN) — be jo GH runner'iai
    // gauna managed_challenge -> 403 (nuo 2026-08-10 desktop-chromium krisdavo)
    extraHTTPHeaders: {
      'X-E2E-Bot': 'bomba-lt-tests-v1',
      ...(process.env.E2E_CF_TOKEN ? { 'X-Imuzika-E2E': process.env.E2E_CF_TOKEN } : {}),
    },
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-iphone',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'tablet-ipad',
      use: { ...devices['iPad Pro 11'] },
    },
  ],

  // NO webServer — testai prieš external URL
});
