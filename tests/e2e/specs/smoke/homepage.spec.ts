import { test, expect } from '../../fixtures/storage';

/**
 * Smoke tests pritaikyti REALIAI imuzika.lt HTML strukturai
 * (po 2026-05-23/24 dual investigation; peržiūrėta 2026-07-31):
 *
 * Findings:
 *  - <header>, <main>, <footer> HTML5 tag'ai EGZISTUOJA ✓
 *  - 404 page'as TURI semantic landmarks ✓
 *  - 2× <nav> elementai, main nav `.bomba-mainnav` su 9 links
 *  - Search yra <button>IEŠKOTI</button>, NE <input type="search">
 *  - Mobile: hamburger button (.md:hidden) NEturi aria-label (bom-008 a11y finding)
 *  - Search button mobile'e PASLĖPTAS iki hamburger atidaroma
 *  - NĖRA cookie consent banner'io (P0 BLOCKING — bom-002, paruošta ~/Projektai/bomba.lt-gdpr/)
 *
 * 2026-07-31 pataisyta (05-26 cutover drift):
 *  - <title> nebe „bomba", o „… | imuzika.lt" → regex atnaujintas
 *  - homepage'oje H1 JAU YRA: <h1 class="bomba-sr-h1"> (sr-only, 1 vnt.) —
 *    senas komentaras „NĖRA <h1> ant homepage'os" nebegalioja (bom-001 uždarytas)
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

    // Title turi turėti site name.
    // 🔴 2026-07-31: buvo /bomba/i — po 05-26 cutover'io title = „… | imuzika.lt",
    // tad testas krito 21× iš eilės, o realios problemos NEBUVO.
    await expect(guestPage).toHaveTitle(/imuzika/i);

    // Lygiai vienas <h1> (SEO + a11y). Homepage'oje jis sr-only: .bomba-sr-h1
    await expect(guestPage.getByRole('heading', { level: 1 })).toHaveCount(1);

    // Console errors filter: praleidžiam network errors + ŽINOMUS third-party noise
    // (analytics, ads, social, cookie consent — jie už mūsų kontrolės ribų)
    const IGNORED_PATTERNS = [
      /net::/i,
      /Failed to load resource/i,
      /google-analytics|googletagmanager|ga\.js|gtm\.js|gtag/i,
      /facebook\.net|fbevents/i,
      /hotjar|clarity\.ms/i,
      /klaro|cookieyes|cookielaw/i,
      /sentry\.io/i,
      /\b(SecurityError|NotAllowedError|AbortError)\b/i, // browser quirks, not app bugs
      /Content Security Policy/i, // CSP noise from third-party scripts
      /WebSocket connection/i,
      // CORS preflight reject on third-party CDNs when X-E2E-Bot header injected
      // (playwright.config.ts extraHTTPHeaders). Not an imuzika.lt bug.
      /Access to .+ from origin .+ has been blocked by CORS policy/i,
      /fonts\.gstatic\.com|fonts\.googleapis\.com/i,
    ];
    const critical = errors.filter((e) => !IGNORED_PATTERNS.some((p) => p.test(e)));
    expect(critical, `Critical app errors: ${critical.join('\n')}`).toEqual([]);
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
