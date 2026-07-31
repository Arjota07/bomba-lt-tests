import { test as base, expect, Page } from '@playwright/test';

/**
 * StorageState fixture for imuzika.lt
 *
 * Prod read-only mode — guest sesija (kiekvienam testui švarus context).
 *
 * NOTE (2026-05-23): tuo metu svetainė NETURĖJO cookie consent banner'io, tad
 * auto-accept logic'as buvo pašalintas.
 * ATNAUJINTA 2026-07-31: banner'is JAU YRA — `div#imz-consent` (bom-002 uždarytas).
 * Auto-accept'o SĄMONINGAI negrąžinam: testai neturi spaudinėti sutikimo mygtukų.
 * Visual testuose banner'is tiesiog maskuojamas (žr. visual/homepage-baseline.spec.ts).
 */

type Fixtures = {
  guestPage: Page;
};

export const test = base.extend<Fixtures>({
  guestPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
