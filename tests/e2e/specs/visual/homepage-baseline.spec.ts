import { test, expect } from '../../fixtures/storage';

/**
 * Visual regression — baseline'ai cross-device
 *
 * Pirma run sukurs baseline screenshots'us.
 * Vėliau lygins prieš juos.
 *
 * Update baseline (po legitimaus dizaino keitimo):
 *   npm run test:update-snapshots
 */

test.describe('Visual regression: Homepage', () => {
  test.beforeEach(async ({ guestPage }) => {
    await guestPage.goto('/');
    await guestPage.waitForLoadState('networkidle', { timeout: 15_000 });
    // Pause for any lazy-loaded above-the-fold images
    await guestPage.waitForTimeout(500);
  });

  test('homepage above-the-fold', async ({ guestPage }) => {
    await expect(guestPage).toHaveScreenshot('homepage-atf.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
      // Mask dynamic content (e.g., timestamps, ads)
      mask: [
        guestPage.locator('[data-dynamic]'),
        guestPage.locator('.live-counter'),
      ],
    });
  });

  test('homepage full page', async ({ guestPage }) => {
    await expect(guestPage).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
    });
  });
});
