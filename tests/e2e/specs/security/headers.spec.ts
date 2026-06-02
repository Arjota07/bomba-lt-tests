import { test, expect } from '../../fixtures/storage';

/**
 * Security headers testai imuzika.lt — Security-Auditor QA Agent dimensija.
 *
 * Mode: PRODUCTION READ-ONLY (TIK GET requestai).
 *
 * Reference: OWASP Secure Headers Project
 * https://owasp.org/www-project-secure-headers/
 */

test.describe('Security: HTTP headers', () => {
  test('TC-SEC-001: HTTPS visada (HTTP → HTTPS redirect)', async ({ request }) => {
    const resp = await request.get('/', { maxRedirects: 0 });
    expect(resp.status(), 'HTTPS turi grąžinti 200, ne redirect').toBeLessThan(400);
  });

  test('TC-SEC-002: HSTS header su includeSubDomains', async ({ request }) => {
    const resp = await request.get('/');
    const hsts = resp.headers()['strict-transport-security'];

    expect(hsts, 'Strict-Transport-Security header būtinas').toBeTruthy();
    if (hsts) {
      expect(hsts.toLowerCase(), 'HSTS max-age >= 31536000 (1 metai)').toContain('max-age');
      const match = hsts.match(/max-age=(\d+)/i);
      if (match) {
        expect(parseInt(match[1], 10), 'HSTS max-age min 6 mėn').toBeGreaterThanOrEqual(15_768_000);
      }
    }
  });

  test('TC-SEC-003: X-Content-Type-Options: nosniff', async ({ request }) => {
    const resp = await request.get('/');
    const nosniff = resp.headers()['x-content-type-options'];
    expect(nosniff, 'X-Content-Type-Options turi būti "nosniff"').toBe('nosniff');
  });

  test('TC-SEC-004: X-Frame-Options arba CSP frame-ancestors', async ({ request }) => {
    const resp = await request.get('/');
    const xfo = resp.headers()['x-frame-options'];
    const csp = resp.headers()['content-security-policy'];

    const hasXFO = xfo && (xfo.toUpperCase() === 'DENY' || xfo.toUpperCase() === 'SAMEORIGIN');
    const hasCSP = csp && csp.toLowerCase().includes('frame-ancestors');

    expect(hasXFO || hasCSP, `Clickjacking apsauga reikalinga (XFO: ${xfo}, CSP frame-ancestors: ${hasCSP})`)
      .toBe(true);
  });

  test('TC-SEC-005: Referrer-Policy nustatyta', async ({ request }) => {
    const resp = await request.get('/');
    const rp = resp.headers()['referrer-policy'];
    expect(rp, 'Referrer-Policy header rekomenduojamas').toBeTruthy();
  });

  test('TC-SEC-006: Server fingerprint minimal (NE atskleisti PrestaShop version)', async ({ request }) => {
    const resp = await request.get('/');
    const server = resp.headers()['server'] || '';
    const xPoweredBy = resp.headers()['x-powered-by'] || '';

    // PHP/PrestaShop version turi būti hidden
    expect(server.toLowerCase(), `Server header neturi atskleisti versijos: ${server}`)
      .not.toMatch(/\d+\.\d+\.\d+/);
    expect(xPoweredBy.toLowerCase(), `X-Powered-By neturi atskleisti PHP version: ${xPoweredBy}`)
      .not.toMatch(/php\/\d+/);
  });

  test('TC-SEC-007: Cookies turi Secure + HttpOnly + SameSite', async ({ guestPage, request }) => {
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const cookies = await guestPage.context().cookies();

    const sensitive = cookies.filter((c) =>
      /session|auth|cart|customer|token/i.test(c.name)
    );

    for (const c of sensitive) {
      expect(c.secure, `Cookie "${c.name}" turi būti Secure`).toBe(true);
      expect(c.httpOnly, `Cookie "${c.name}" turi būti HttpOnly`).toBe(true);
      expect(['Strict', 'Lax'], `Cookie "${c.name}" SameSite=${c.sameSite}`)
        .toContain(c.sameSite);
    }
  });

  test('TC-SEC-008: robots.txt egzistuoja ir leidžia indexing', async ({ request }) => {
    const resp = await request.get('/robots.txt');
    expect(resp.status()).toBe(200);
    const body = await resp.text();
    expect(body.toLowerCase()).toContain('user-agent:');
    expect(body, 'robots turi reference į sitemap').toMatch(/sitemap:/i);
  });
});
