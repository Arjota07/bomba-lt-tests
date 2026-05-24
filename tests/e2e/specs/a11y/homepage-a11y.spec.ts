import { test, expect } from '../../fixtures/storage';
import AxeBuilder from '@axe-core/playwright';

/**
 * A11y (axe-core) testai bomba.lt.
 *
 * QA Agent dimensija: UX-Auditor / Security-Auditor (WCAG 2.1 AA).
 *
 * Mode: PRODUCTION READ-ONLY. Tik publikuoja violations.
 *
 * Žinomos issue (2026-05-24 baseline po bom-008 deploy):
 *   - bom-001: nėra <h1> ant homepage'os (heading-order, page-has-heading-one)
 *   - bom-008: ✅ pataisyta — mobile search btn turi aria-label="Ieškoti"
 *
 * Tests neturi fail'inti dėl baseline violations — fail'ina TIK jei atsiranda NAUJI.
 */

const KNOWN_VIOLATIONS = new Set([
  'page-has-heading-one',  // bom-001 DEPLOYED 2026-05-24 — SR-only h1
  'heading-order',         // bom-001 follow-up (heading hierarchy)
  'color-contrast',        // tema priklausoma — flag, neblock
  'nested-interactive',    // ps_imageslider <li role="option"> turi focusable child (PS core, upstream issue)
]);

test.describe('A11y: WCAG 2.1 AA — axe-core', () => {
  test('TC-A11Y-001: homepage neturi NAUJŲ critical/serious violations', async ({ guestPage }) => {
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await guestPage.waitForTimeout(1500); // images lazy load

    const results = await new AxeBuilder({ page: guestPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const newViolations = results.violations.filter(
      (v) => !KNOWN_VIOLATIONS.has(v.id) && (v.impact === 'critical' || v.impact === 'serious')
    );

    if (newViolations.length > 0) {
      console.log('🔴 NAUJI a11y violations:');
      for (const v of newViolations) {
        console.log(`  - [${v.impact}] ${v.id}: ${v.description}`);
        console.log(`    Nodes: ${v.nodes.length}, Help: ${v.helpUrl}`);
      }
    }

    expect(newViolations, `Naujų WCAG violations: ${newViolations.map(v => v.id).join(', ')}`)
      .toEqual([]);
  });

  test('TC-A11Y-002: 404 page a11y', async ({ guestPage }) => {
    await guestPage.goto('/this-does-not-exist-axe-test-zzz', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    const results = await new AxeBuilder({ page: guestPage })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => !KNOWN_VIOLATIONS.has(v.id) && v.impact === 'critical'
    );

    expect(critical, `404 critical violations: ${critical.map(v => v.id).join(', ')}`)
      .toEqual([]);
  });

  test('TC-A11Y-003: visi interaktyvūs elementai turi accessible name', async ({ guestPage }) => {
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const results = await new AxeBuilder({ page: guestPage })
      .include('body')
      .withRules(['button-name', 'link-name', 'image-alt', 'input-image-alt', 'aria-required-attr'])
      .analyze();

    expect(
      results.violations,
      `Interactive elementai be name'o: ${JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length })), null, 2)}`
    ).toEqual([]);
  });

  test('TC-A11Y-004: keyboard navigation — Tab fokusas matomas', async ({ guestPage }) => {
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Pirmas Tab — turi būti skip-link arba pirmas interaktyvus elementas
    await guestPage.keyboard.press('Tab');

    const focused = await guestPage.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const styles = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 50),
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
      };
    });

    expect(focused, 'Pirmas Tab spūdis turi suteikti focus elementui').not.toBeNull();

    // Outline arba boxShadow turi būti matomas (focus indicator)
    const hasVisibleFocus =
      focused!.outline !== 'none' && focused!.outline !== '' ||
      focused!.boxShadow !== 'none';

    expect(hasVisibleFocus, `Focus indicator: outline=${focused!.outline}, shadow=${focused!.boxShadow}`)
      .toBe(true);
  });
});
