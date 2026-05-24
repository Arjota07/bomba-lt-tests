import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for bomba.lt — PrestaShop 9.1.1
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
 *   BASE_URL=https://bomba.lt npm test  # override URL
 */

const BASE_URL = process.env.BASE_URL || 'https://bomba.lt';

export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,

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
        framework: 'PrestaShop 9.1.1',
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
    extraHTTPHeaders: {
      'X-E2E-Bot': 'bomba-lt-tests-v1',
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
