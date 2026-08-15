import { test, expect } from '../../fixtures/storage';

/**
 * Visual regression — baseline'ai cross-device
 *
 * Pirma run sukurs baseline screenshots'us.
 * Vėliau lygins prieš juos.
 *
 * Update baseline (po legitimaus dizaino keitimo):
 *   npm run test:update-snapshots
 *
 * 🔴 2026-08-15 baseline'ų FORMATAS: `.png` → `.webp` (Playwright 1.62 palaiko
 * WebP snapshot'us — formatą lemia failo plėtinys `toHaveScreenshot()` argumente,
 * globalaus config option'o nėra). WebP čia LOSSLESS (quality 100 = default),
 * t. y. pikselis į pikselį toks pat kaip PNG, tik ~2-3× mažesnis repo'e —
 * full-page baseline'ai buvo ~1.6 MB ir augo su kiekvienu refresh'u.
 * Kartu su 1.62 atėjo Chromium 151 / WebKit 26.5, tad SENIEJI PNG baseline'ai
 * vis tiek buvo negaliojantys (kitas rendering'as) — jie ištrinti, o nauji
 * generuojami įprasta tvarka: workflow_dispatch → qa_suite=visual → artifact
 * `visual-snapshots-linux` → commit. Mac (`-darwin`) baseline'ai — lokaliai
 * su `npm run test:update-snapshots`.
 *
 * 🔴 2026-07-31 baseline'ai PERDARYTI. Senieji buvo iš 2026-05-24 ir jau nebeatitiko:
 * full-page aukštis 3840 → 5915 px (svetainė paaugo per 2 mėn.), diff 22 % ⇒ suite
 * krito kiekvieną kartą ir jokios realios regresijos nebūtų parodęs.
 * Prieš perdarant vaizdas patikrintas akimis — puslapis sveikas, ne sugadintas.
 * Nauja maskė: `#imz-consent` — cookie banner'is atsirado po 05-24 (bom-002),
 * jis dinamiškas, tad be maskės kiekvienas run'as duotų skirtumą.
 */

test.describe('Visual regression: Homepage', () => {
  test.beforeEach(async ({ guestPage }) => {
    await guestPage.goto('/');
    // 🔴 NEnaudoti `networkidle`: analytics/Ads pikseliai (GTM, Facebook, doubleclick)
    // siunčia requestus nuolat, tad tinklas „nenurimsta" ir laukimas krisdavo į
    // 15 s timeout maždaug kas trečią paleidimą (07-31 diagnozė — tai buvo TIKROJI
    // visual suite'o nestabilumo priežastis, ne pikselių skirtumai).
    // `load` + tikslus paveikslėlių laukimas žemiau yra deterministiški.
    await guestPage.waitForLoadState('load', { timeout: 20_000 });

    // 🔴 Sustabdom karuselę PRIEŠ bet kokį laukimą. Ji sukasi kas 5 s
    // (data-interval="5000"); pasikeitus skaidrei užsikrauna nauja lazy nuotrauka,
    // hero aukštis šokteli ir VISAS turinys žemiau pasislenka. `mask` to nesutvarko —
    // ji slepia turinį, bet ne aukštį. Patikrinta 07-31: po pause aukštis 5915 px
    // nejuda 7 s, aktyvi lieka pirma skaidrė. Tema naudoja jQuery + Bootstrap 4.
    await guestPage.evaluate(() => {
      const jq = (window as unknown as { jQuery?: any }).jQuery;
      if (jq && jq.fn && jq.fn.carousel) jq('.carousel').carousel('pause');
    });

    // 🔴 2026-07-31: `networkidle` + 500ms NEPAKAKO. Hero paveikslėlis kartais dar
    // nebūdavo dekoduotas ⇒ slideris kitokio aukščio ⇒ VISAS turinys žemiau
    // pasislinkdavo ~3 px ⇒ desktop ATF krisdavo maždaug kas antrą paleidimą.
    // `mask` čia nepadeda: ji uždengia turinį, bet ne elemento AUKŠTĮ.
    // Laukiam, kol EAGER paveikslėliai viršuje realiai turi matmenis (complete +
    // naturalHeight), t. y. kol layout'as nustoja judėti.
    // ⚠️ `loading="lazy"` PRIVALOMA praleisti: 6 neaktyvios slider skaidrės yra lazy
    // ir užsikrauna tik karuselei pasisukus — sąlygos „visi paveikslėliai" įvykdyti
    // NEĮMANOMA, waitForFunction tiesiog nueitų į 15 s timeout (patikrinta 07-31).
    await guestPage.waitForFunction(
      () =>
        Array.from(document.images)
          .filter(
            (img) =>
              img.loading !== 'lazy' &&
              img.getBoundingClientRect().top < window.innerHeight * 2
          )
          .every((img) => img.complete && img.naturalHeight > 0),
      null,
      { timeout: 15_000 }
    );
    await guestPage.waitForTimeout(500);
  });

  test('homepage above-the-fold', async ({ guestPage }) => {
    await expect(guestPage).toHaveScreenshot('homepage-atf.webp', {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
      // Mask dynamic content (carousel, timestamps, ads)
      mask: [
        guestPage.locator('.bomba-hero-slider'),
        guestPage.locator('.carousel'),
        guestPage.locator('[data-dynamic]'),
        guestPage.locator('.live-counter'),
        guestPage.locator('#imz-consent'),
      ],
    });
  });

  test('homepage full page', async ({ guestPage }) => {
    // Stop animations to reduce carousel timing flake
    await guestPage.evaluate(() => {
      document.querySelectorAll('.carousel, .bomba-hero-slider').forEach((el) => {
        el.querySelectorAll('*').forEach((child) => {
          (child as HTMLElement).style.animation = 'none';
          (child as HTMLElement).style.transition = 'none';
        });
      });
    });
    await expect(guestPage).toHaveScreenshot('homepage-full.webp', {
      fullPage: true,
      maxDiffPixelRatio: 0.05, // 5% tolerance (was 3% — carousel residual jitter)
      // 🔴 2026-07-31 (v2): produktų grid'ai (Naujienos / Ką tik gauta / Perkamiausi),
      // žanrų-formatų skaitliukai ir blog sąrašas keičiasi su KATALOGO TURINIU kasdien —
      // be maskių testas klykia po kiekvieno pajamavimo/valymo, nors svetainė sveika
      // (16:31 run: 9 % diff vien iš turinio rotacijos). Šis testas saugo LAYOUT'Ą
      // ir statinį chrome, ne katalogo turinį. Maskė slepia turinį, bet ne aukštį —
      // sekcijų aukščiai stabilūs (fiksuotas kortelių tinklelis).
      mask: [
        guestPage.locator('.bomba-hero-slider'),
        guestPage.locator('.carousel'),
        guestPage.locator('#imz-consent'),
        guestPage.locator('section.featured-products'),
        guestPage.locator('.bomba-genre-grid'),
        guestPage.locator('.bomba-home-articles'),
      ],
    });
  });
});
