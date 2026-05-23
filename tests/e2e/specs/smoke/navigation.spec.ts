import { test, expect } from '../../fixtures/storage';

test.describe('Smoke: Navigation', () => {
  test('TC-004: main menu links 200 OK', async ({ guestPage }) => {
    await guestPage.goto('/');

    const navLinks = guestPage.getByRole('navigation').first().getByRole('link');
    const linkCount = await navLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    // Patikrinam pirmuosius 5 internal links
    const hrefsToCheck: string[] = [];
    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      if (href && (href.startsWith('/') || href.includes('bomba.lt'))) {
        // Filter out javascript: arba external
        if (!href.startsWith('javascript:') && !href.startsWith('mailto:')) {
          hrefsToCheck.push(href.startsWith('http') ? new URL(href).pathname : href);
        }
      }
    }

    for (const href of hrefsToCheck) {
      const resp = await guestPage.goto(href, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      expect(resp?.status(), `Nav link ${href} returned ${resp?.status()}`).toBeLessThan(400);
    }
  });

  test('TC-005: 404 page is friendly (NE white screen)', async ({ guestPage }) => {
    const resp = await guestPage.goto('/this-page-does-not-exist-12345-zzz');
    // PrestaShop default 404 may return 200 with error page OR true 404
    expect([200, 404]).toContain(resp?.status() ?? 0);

    // Header + footer turi būti matomi (NE white screen)
    await expect(guestPage.getByRole('banner')).toBeVisible();
    await expect(guestPage.getByRole('contentinfo')).toBeVisible();
  });
});
