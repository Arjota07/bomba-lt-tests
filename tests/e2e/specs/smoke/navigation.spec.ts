import { test, expect } from '../../fixtures/storage';

test.describe('Smoke: Navigation', () => {
  test('TC-004: main menu links 200 OK', async ({ guestPage }, testInfo) => {
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    if (testInfo.project.name === 'mobile-iphone') {
      // Mobile: #bomba-mainnav display:none iki hamburger open (žr. homepage TC-002)
      const hamburger = guestPage.locator('#bomba-hamburger');
      if (await hamburger.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await hamburger.click();
        await guestPage.locator('#bomba-mainnav.is-open').waitFor({ state: 'visible', timeout: 5_000 });
      }
    }

    const navLinks = guestPage.getByRole('navigation').first().getByRole('link');
    const linkCount = await navLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    // Patikrinam pirmuosius 5 internal links
    const hrefsToCheck: string[] = [];
    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      // 2026-07-31: po cutover'io nav nuorodos absoliučios į imuzika.lt, ne bomba.lt
      if (href && (href.startsWith('/') || /\b(imuzika|bomba)\.lt\b/.test(href))) {
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

    // 404 turi: title "404 klaida | iMuzika.lt", H1 su klaidos žinute
    // + pilna site layout (header + main + footer)
    await expect(guestPage.getByRole('banner')).toBeVisible({ timeout: 10_000 });
    await expect(guestPage.getByRole('contentinfo')).toBeVisible();

    // H1 su error message. `.first()` — nes žemiau atskirai tikrinam KIEKĮ;
    // be jo strict mode nukirsdavo testą dar prieš tai (2026-07-30 gedimas).
    await expect(guestPage.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('TC-006: 404 puslapis turi LYGIAI VIENĄ h1', async ({ guestPage }) => {
    // Regresijos sargas. 2026-06-20 (tseo-06) į not-found.tpl buvo įdėtas ANTRAS h1
    // remiantis klaidinga prielaida, kad classic/page.tpl page_header h1 čia tuščias —
    // jis NĖRA tuščias, tad 404 nuo tada renderino du h1. Pataisyta 2026-07-31
    // (pašalintas .bomba-404-title h1; liko page_header „Puslapis, kurio ieškote, nerastas.").
    // 410 (`errors/410.tpl`) patikrintas gyvai TĄ PAČIĄ DIENĄ — ten 1 h1, viskas tvarkoje.
    const resp = await guestPage.goto('/this-page-does-not-exist-12345-zzz', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    expect(resp?.status()).toBe(404);
    await expect(guestPage.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
});
