import { test, expect } from '../../fixtures/storage';

test.describe('Smoke: Navigation', () => {
  test('TC-004: main menu links 200 OK', async ({ guestPage }) => {
    await guestPage.goto('/');

    const navLinks = guestPage.getByRole('navigation').first().getByRole('link');
    const linkCount = await navLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    const hrefsToCheck: string[] = [];
    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      if (href && href.startsWith('/')) {
        hrefsToCheck.push(href);
      }
    }

    for (const href of hrefsToCheck) {
      const resp = await guestPage.goto(href);
      expect(resp?.status(), `Navigation link ${href} returned ${resp?.status()}`).toBeLessThan(400);
      await guestPage.waitForLoadState('domcontentloaded', { timeout: 10_000 });
    }
  });

  test('TC-005: 404 page is user-friendly', async ({ guestPage }) => {
    const resp = await guestPage.goto('/this-page-does-not-exist-12345-zzz');
    expect(resp?.status()).toBe(404);

    // Vis tiek turi būti header+footer (NE white screen)
    await expect(guestPage.getByRole('banner')).toBeVisible();
    await expect(guestPage.getByRole('contentinfo')).toBeVisible();
  });
});
