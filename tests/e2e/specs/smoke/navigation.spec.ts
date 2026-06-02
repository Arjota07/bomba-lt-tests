import { test, expect } from '../../fixtures/storage';

test.describe('Smoke: Navigation', () => {
  test('TC-004: main menu links 200 OK', async ({ guestPage }) => {
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const navLinks = guestPage.getByRole('navigation').first().getByRole('link');
    const linkCount = await navLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    // Patikrinam pirmuosius 5 internal links
    const hrefsToCheck: string[] = [];
    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      if (href && (href.startsWith('/') || href.includes('imuzika.lt') || href.includes('bomba.lt'))) {
        if (!href.startsWith('javascript:') && !href.startsWith('mailto:')) {
          hrefsToCheck.push(href.startsWith('http') ? new URL(href).pathname : href);
        }
      }
    }

    for (const href of hrefsToCheck) {
      const resp = await guestPage.goto(href, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      expect(resp?.status(), `Nav link ${href} returned ${resp?.status()}`).toBeLessThan(400);
    }
  });

  test('TC-005: 404 page is friendly (semantic layout + h1)', async ({ guestPage }) => {
    const resp = await guestPage.goto('/this-page-does-not-exist-12345-zzz', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    expect(resp?.status()).toBe(404);

    // imuzika.lt 404 turi: title "404 klaida", <h1>"Puslapis, kurio ieškote, nerastas."
    // + pilna site layout (header + main + footer)
    await expect(guestPage.getByRole('banner')).toBeVisible({ timeout: 10_000 });
    await expect(guestPage.getByRole('contentinfo')).toBeVisible();

    // H1 su error message
    const h1 = guestPage.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
  });
});
