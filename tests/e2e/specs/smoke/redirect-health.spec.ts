import { test, expect } from '@playwright/test';

/**
 * Redirect-health: bomba.lt domenas (retired-brand stub po cutover'io 2026-05-26)
 * turi LIKTI gyvas ir vesti į kanoninį prod www.imuzika.lt.
 *
 * Kodėl atskiras testas: pagrindinė suite testuoja imuzika.lt (BASE_URL), todėl
 * bomba.lt redirect'as liktų nepastebėtas, jei jis tyliai sulūžtų (SSL expiry,
 * DNS, ar PS shop_url klaida → 5xx / dead / loop). Šis testas saugo invariantą.
 *
 * INVARIANTAS (robust 301 IR 302): bomba.lt/ → 3xx → galiausiai 200 ant www.imuzika.lt.
 *
 * NB (2026-06-01 tyrimas): šiuo metu redirect = 302 ir NUMETA path į homepage
 * (PrestaShop core canonical-domain redirect; bomba.lt nėra registruotas ps_shop_url).
 * Query string IŠLIEKA, path — ne. Jei .htaccess'e bus pridėtas path-preserving 301
 * (laukia Andriaus sprendimo) — sustiprinti TC-RDR-003 iš `.skip` į aktyvų assertą.
 */

const BOMBA = 'https://bomba.lt';
const CANONICAL_HOST = 'www.imuzika.lt';

test.describe('Smoke: bomba.lt redirect health', () => {
  test('TC-RDR-001: bomba.lt/ redirect gyvas → www.imuzika.lt 200', async ({ request }) => {
    // Redirect hop (be follow): turi būti 3xx į imuzika.lt
    const hop = await request.get(`${BOMBA}/`, { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308], `bomba.lt/ turi grąžinti redirect, gavo ${hop.status()}`)
      .toContain(hop.status());

    const loc = hop.headers()['location'] || '';
    expect(loc, `Location turi vesti į ${CANONICAL_HOST}: "${loc}"`).toContain(CANONICAL_HOST);

    // Following redirects → galutinis 200 ant kanoninio host
    const final = await request.get(`${BOMBA}/`);
    expect(final.status(), 'Galutinis atsakymas turi būti 200').toBe(200);
    expect(new URL(final.url()).host, 'Galutinis host turi būti kanoninis').toBe(CANONICAL_HOST);
  });

  test('TC-RDR-002: bomba.lt redirect target = HTTPS (ne plaintext)', async ({ request }) => {
    const hop = await request.get(`${BOMBA}/`, { maxRedirects: 0 });
    const loc = hop.headers()['location'] || '';
    expect(loc.startsWith('https://'), `Redirect target turi būti HTTPS: "${loc}"`).toBe(true);
  });

  // PENDING (Andriaus sprendimas): jei pereisim į path-preserving 301, įjungti šį.
  // Šiuo metu bomba.lt/<path> → 302 → www.imuzika.lt/ (path numetamas), todėl skip.
  test.skip('TC-RDR-003: path-preserving — bomba.lt/11-cd → www.imuzika.lt/11-cd', async ({ request }) => {
    const hop = await request.get(`${BOMBA}/11-cd`, { maxRedirects: 0 });
    const loc = hop.headers()['location'] || '';
    expect(loc).toContain(`${CANONICAL_HOST}/11-cd`);
  });
});
