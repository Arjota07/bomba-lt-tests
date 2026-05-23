import { test, expect } from '../../fixtures/storage';

/**
 * Smoke tests pritaikyti REALIAI bomba.lt HTML strukturai
 * (po 2026-05-23 investigation):
 *
 * Findings:
 *  - <header>, <main>, <footer> HTML5 tag'ai EGZISTUOJA (ARIA banner/main/contentinfo)
 *  - 2× <nav> elementai (main nav `.bomba-mainnav` su 9 links)
 *  - Search yra <button>IEŠKOTI</button>, NE <input type="search">
 *  - Footer.linkCount = 0 (galimas Maintenance Agent finding'as P2)
 *  - NĖRA <h1> ant homepage'os (a11y P1 finding'as)
 *  - NĖRA cookie consent banner'io
 */

test.describe('Smoke: Homepage', () => {
  test('TC-001: homepage loads su key landmarks', async ({ guestPage }) => {
    const errors: string[] = [];
    guestPage.on('console', (msg: any) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const response = await guestPage.goto('/');
    expect(response?.status()).toBeLessThan(400);

    // <header>, <main>, <footer> HTML5 tag'ai → atitinkamos ARIA roles
    await expect(guestPage.getByRole('banner')).toBeVisible();
    await expect(guestPage.getByRole('main')).toBeVisible();
    await expect(guestPage.getByRole('contentinfo')).toBeVisible();

    // Title turi turėti site name
    await expect(guestPage).toHaveTitle(/bomba/i);

    await guestPage.waitForLoadState('networkidle', { timeout: 15_000 });

    const critical = errors.filter((e) =>
      !e.includes('net::') && !e.includes('Failed to load resource')
    );
    expect(critical).toEqual([]);
  });

  test('TC-002: search button matomas', async ({ guestPage }) => {
    await guestPage.goto('/');
    // bomba.lt naudoja <button>IEŠKOTI</button>, NE input type="search"
    const searchBtn = guestPage.getByRole('button', { name: /ieškoti/i }).first();
    await expect(searchBtn).toBeVisible();
  });

  test('TC-003: main navigation turi ≥5 kategorijų', async ({ guestPage }) => {
    await guestPage.goto('/');
    // Main nav `<nav class="bomba-mainnav">` turi 9 kategorijų links
    const navLinks = guestPage.getByRole('navigation').first().getByRole('link');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});
