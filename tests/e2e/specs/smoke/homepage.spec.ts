import { test, expect } from '../../fixtures/storage';

/**
 * Smoke tests pritaikyti REALIAI bomba.lt HTML strukturai
 * (po 2026-05-23/24 dual investigation):
 *
 * Findings:
 *  - <header>, <main>, <footer> HTML5 tag'ai EGZISTUOJA ✓
 *  - 404 page'as TURI semantic landmarks ✓
 *  - 2× <nav> elementai, main nav `.bomba-mainnav` su 9 links
 *  - Search yra <button>IEŠKOTI</button>, NE <input type="search">
 *  - Mobile: hamburger button (.md:hidden) NEturi aria-label (bom-008 a11y finding)
 *  - Search button mobile'e PASLĖPTAS iki hamburger atidaroma
 *  - NĖRA <h1> ant homepage'os desktop (a11y P1 — bom-001)
 *  - NĖRA cookie consent banner'io (P0 BLOCKING — bom-002, paruošta ~/Projektai/bomba.lt-gdpr/)
 */

test.describe('Smoke: Homepage', () => {
  test('TC-001: homepage loads su key landmarks', async ({ guestPage }) => {
    const errors: string[] = [];
    guestPage.on('console', (msg: any) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const response = await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(response?.status()).toBeLessThan(400);

    // <header>, <main>, <footer> HTML5 tag'ai → atitinkamos ARIA roles
    await expect(guestPage.getByRole('banner')).toBeVisible({ timeout: 15_000 });
    await expect(guestPage.getByRole('main')).toBeVisible();
    await expect(guestPage.getByRole('contentinfo')).toBeVisible();

    // Title turi turėti site name
    await expect(guestPage).toHaveTitle(/bomba/i);

    const critical = errors.filter((e) =>
      !e.includes('net::') && !e.includes('Failed to load resource')
    );
    expect(critical).toEqual([]);
  });

  test('TC-002: search button matomas (mobile context behind hamburger)', async ({ guestPage }, testInfo) => {
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const isMobile = testInfo.project.name === 'mobile-iphone';

    if (isMobile) {
      // Mobile: search button paslėptas iki hamburger menu open
      // Atidarom hamburger (button su md:hidden klase ar aria-label)
      const hamburger = guestPage.locator('button.md\\:hidden').first()
        .or(guestPage.getByRole('button', { name: /meniu|menu|☰/i }));

      if (await hamburger.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await hamburger.click();
        await guestPage.waitForTimeout(500); // menu animation
      }
    }

    const searchBtn = guestPage.getByRole('button', { name: /ieškoti/i }).first();
    await expect(searchBtn).toBeVisible({ timeout: 10_000 });
  });

  test('TC-003: main navigation turi ≥5 kategorijų', async ({ guestPage }) => {
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Main nav `<nav class="bomba-mainnav">` turi 9 kategorijų links
    const navLinks = guestPage.getByRole('navigation').first().getByRole('link');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});
