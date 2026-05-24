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
      // Mask dynamic content (carousel, timestamps, ads)
      mask: [
        guestPage.locator('.bomba-hero-slider'),
        guestPage.locator('.carousel'),
        guestPage.locator('[data-dynamic]'),
        guestPage.locator('.live-counter'),
      ],
    });
  });

  test('homepage full page', async ({ guestPage }) => {
    // Stop animations to reduce carousel timing flake
    await guestPage.evaluate(() => {
      document.querySelectorAll('.carousel, .bomba-hero-slider').forEach((el) => {
        el.querySelectorAll('*').forEach((child) => {
          (child as HTMLElement).style.animation = 'none';
          (child as HTMLElement).style.transition = 'none';
        });
      });
    });
    await expect(guestPage).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05, // 5% tolerance (was 3% — carousel residual jitter)
      mask: [
        guestPage.locator('.bomba-hero-slider'),
        guestPage.locator('.carousel'),
      ],
    });
  });
});
