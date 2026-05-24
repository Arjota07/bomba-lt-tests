import { test, expect } from '../../fixtures/storage';

/**
 * Critical checkout flows — read-only smoke tests bomba.lt.
 *
 * MODE: PRODUCTION READ-ONLY. JOKIO actual checkout, payment, ar order submit.
 *       Tikrinam TIK ar puslapiai/redirect'ai veikia korektiškai.
 *
 * Patikros:
 *   - /pirkinio-krepselis (PrestaShop cart) — empty state matomas
 *   - /prisijungimas — login form egzistuoja
 *   - /apmokejimas — guest checkout redirect arba login prompt
 *   - /paieska — search puslapis veikia
 *   - sitemap.xml — yra ir nurodo URL'us
 *   - product page random sample — schema.org Product markup
 */

test.describe('Critical checkout flows (read-only)', () => {
  test('TC-CHK-001: cart page renders empty state', async ({ guestPage }) => {
    // PrestaShop default URLs: /cart, /panier, ar friendly URL
    const cartUrls = ['/cart?action=show', '/cart', '/index.php?controller=cart'];

    let renderedOk = false;
    for (const url of cartUrls) {
      const resp = await guestPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      if (resp && resp.status() < 400) {
        const body = await guestPage.textContent('body');
        if (body && /krepšel|cart|empty|tuščias/i.test(body)) {
          renderedOk = true;
          break;
        }
      }
    }

    expect(renderedOk, 'Cart page must render with empty-state messaging').toBe(true);
  });

  test('TC-CHK-002: login/register page accessible', async ({ guestPage }) => {
    const loginUrls = ['/prisijungimas', '/login', '/index.php?controller=authentication'];

    let loginFound = false;
    for (const url of loginUrls) {
      const resp = await guestPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      if (resp && resp.status() < 400) {
        // Email/password input'ai (skip if redirect to homepage)
        const emailInput = guestPage.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          loginFound = true;
          break;
        }
      }
    }

    expect(loginFound, 'Login form must be accessible su email input').toBe(true);
  });

  test('TC-CHK-003: search functionality returns results page', async ({ guestPage }) => {
    // PrestaShop search per ?controller=search&s=
    const searchTerm = 'cd';
    const resp = await guestPage.goto(`/?controller=search&s=${searchTerm}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    expect(resp?.status()).toBeLessThan(400);

    // Tikrinam ar yra rezultatų ar "no results" žinutė
    const body = await guestPage.textContent('body');
    expect(body).toBeTruthy();

    const hasResults = /rezultat|prek|produkt|item|product|nerasta|nothing|nepavyko/i.test(body || '');
    expect(hasResults, 'Search results page must show results OR no-results message').toBe(true);
  });

  test('TC-CHK-004: sitemap.xml egzistuoja ir teisingo formato', async ({ request }) => {
    const resp = await request.get('https://bomba.lt/sitemap.xml');
    expect(resp.status()).toBeLessThan(400);

    const xml = await resp.text();
    expect(xml, 'sitemap turi būti XML su <urlset> arba <sitemapindex>').toMatch(
      /<urlset|<sitemapindex/
    );
  });

  test('TC-CHK-005: product page (random sample) turi schema.org Product markup', async ({ guestPage }) => {
    // Pirma einam į homepage'ą, randam pirmą product linką
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const productLink = await guestPage.evaluate(() => {
      // STRATEGIJA #1: PrestaShop standartiniai product card selektoriai
      const productCards = Array.from(
        document.querySelectorAll(
          '.product-miniature a[href], .products .product a[href], article.product a[href], [data-id-product] a[href]'
        )
      ) as HTMLAnchorElement[];

      for (const a of productCards) {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('http') && !href.includes('#') && !href.includes('?add-to-cart')) {
          return a.href;
        }
      }

      // STRATEGIJA #2: fallback į URL'us kurie atrodo kaip PS produktai
      // PS produktai: /<lt-name>/<id>-<rewrite>.html ARBA /<id>-<rewrite> kur rewrite turi >=2 vidinius brūkšnius
      const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        if (
          /\/\d+-[a-z0-9-]+\.html?/i.test(href) || // /123-album-name.html
          /\?id_product=\d+/.test(href)
        ) {
          return a.href;
        }
      }

      return null;
    });

    if (!productLink) {
      test.skip(true, 'Nepavyko rasti product linko homepage\'oje');
      return;
    }

    const resp = await guestPage.goto(productLink, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    expect(resp?.status()).toBeLessThan(400);

    // Schema.org Product markup
    const hasProductSchema = await guestPage.evaluate(() => {
      // JSON-LD
      const ldjson = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of ldjson) {
        try {
          const data = JSON.parse(s.textContent || '{}');
          const types = Array.isArray(data) ? data : [data];
          if (types.some((t: any) => t['@type'] === 'Product' || (Array.isArray(t['@type']) && t['@type'].includes('Product')))) {
            return true;
          }
        } catch {}
      }
      // Microdata fallback
      return !!document.querySelector('[itemtype*="schema.org/Product"]');
    });

    expect(hasProductSchema, 'Product page must have schema.org Product markup (SEO)').toBe(true);
  });

  test('TC-CHK-006: contact page accessible (NE submitinti formos)', async ({ guestPage }) => {
    const contactUrls = ['/kontaktai', '/contact-us', '/index.php?controller=contact'];

    let contactFound = false;
    for (const url of contactUrls) {
      const resp = await guestPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      if (resp && resp.status() < 400) {
        // Contact form
        const form = guestPage.locator('form').first();
        if (await form.isVisible({ timeout: 3000 }).catch(() => false)) {
          contactFound = true;
          break;
        }
      }
    }

    expect(contactFound, 'Contact page must be accessible').toBe(true);
  });
});
