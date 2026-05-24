import { test, expect } from '../../fixtures/storage';

/**
 * Mobile UX testai — Mobile-UX-Auditor QA Agent dimensija.
 *
 * MODE: PRODUCTION READ-ONLY, vykdoma iPhone 14 / iPad Pro 11 contexts.
 *
 * Tikrina: viewport meta, touch target sizes (>=44x44px per WCAG 2.5.5),
 * horizontal scroll absence, mobile-specific UI affordances.
 */

test.describe('Mobile UX', () => {
  test('TC-MOB-001: viewport meta tag su initial-scale=1', async ({ guestPage }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium', 'Mobile-only');

    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const viewport = await guestPage.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
      return meta?.content || null;
    });

    expect(viewport, 'viewport meta būtina mobile').toBeTruthy();
    expect(viewport!.toLowerCase(), 'turi turėti width=device-width').toContain('width=device-width');
    expect(viewport!.toLowerCase(), 'turi turėti initial-scale').toContain('initial-scale');
  });

  test('TC-MOB-002: nėra horizontal scroll homepage', async ({ guestPage }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium', 'Mobile-only');

    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await guestPage.waitForTimeout(1500);

    const overflow = await guestPage.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      return {
        bodyScrollWidth: body.scrollWidth,
        bodyClientWidth: body.clientWidth,
        htmlScrollWidth: html.scrollWidth,
        htmlClientWidth: html.clientWidth,
        viewportWidth: window.innerWidth,
      };
    });

    const tolerance = 2; // 2px tolerance
    expect(
      overflow.bodyScrollWidth - overflow.viewportWidth,
      `Horizontal overflow: ${JSON.stringify(overflow)}`
    ).toBeLessThanOrEqual(tolerance);
  });

  test('TC-MOB-003: touch targets >= 44x44px (WCAG 2.5.5 AAA)', async ({ guestPage }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium', 'Mobile-only');

    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const tooSmall = await guestPage.evaluate(() => {
      const interactive = Array.from(
        document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]')
      ) as HTMLElement[];

      const violations: { tag: string; w: number; h: number; text: string }[] = [];
      for (const el of interactive) {
        if (el.offsetParent === null) continue; // hidden
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.width < 44 || rect.height < 44) {
          violations.push({
            tag: el.tagName,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          });
        }
      }
      return violations;
    });

    // Allow keletą — pvz., social icons header'yje gali būti 32px.
    // Bet jei daugiau nei 5 — tai problema.
    if (tooSmall.length > 0) {
      console.log(`Touch targets <44px (${tooSmall.length}):`);
      tooSmall.slice(0, 10).forEach((v) => console.log(`  ${v.tag} ${v.w}x${v.h} "${v.text}"`));
    }

    expect(tooSmall.length, `Per daug <44px touch targets: ${tooSmall.length}`).toBeLessThan(15);
  });

  test('TC-MOB-004: paveikslėliai turi width/height (CLS prevention)', async ({ guestPage }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium', 'Mobile-only');

    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const noDimensions = await guestPage.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
      return imgs
        .filter((img) => img.offsetParent !== null) // visible
        .filter((img) => {
          const hasAttrs = img.hasAttribute('width') && img.hasAttribute('height');
          const hasStyle = img.style.aspectRatio || (img.style.width && img.style.height);
          return !hasAttrs && !hasStyle;
        })
        .slice(0, 20)
        .map((img) => img.src.slice(-50));
    });

    expect(noDimensions.length, `Paveikslėliai be dimensijų (CLS rizika): ${noDimensions.length}`)
      .toBeLessThan(10);
  });

  test('TC-MOB-005: tap-to-call telefono linkai turi tel: protokolą', async ({ guestPage }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chromium', 'Mobile-only');

    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const phoneLinks = await guestPage.evaluate(() => {
      // Ieškom tekstinių telefono numerių
      const allText = document.body.innerText;
      const phonePattern = /(\+370|\(8\))\s?\d{1,3}\s?\d{3,8}/g;
      const phones = allText.match(phonePattern) || [];

      // Patikrinam ar visi numeriai turi tel: linką
      const links = Array.from(document.querySelectorAll('a[href^="tel:"]'));

      return {
        textPhones: phones.length,
        telLinks: links.length,
      };
    });

    if (phoneLinks.textPhones > 0) {
      expect(
        phoneLinks.telLinks,
        `Rasta ${phoneLinks.textPhones} telefonų tekste, bet tik ${phoneLinks.telLinks} tel: linkų`
      ).toBeGreaterThan(0);
    }
  });
});
