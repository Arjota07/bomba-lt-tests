import { test as base, expect, Page } from '@playwright/test';

/**
 * StorageState fixture for bomba.lt
 *
 * Prod read-only mode — guest sesija.
 *
 * NOTE (2026-05-23 investigation): bomba.lt NETURI cookie consent banner'io.
 * Anksčiau buvęs auto-accept logic'as pašalintas (waste — bandydavo paspausti
 * neegzistuojantį button'ą + timeout'indavo 1500ms).
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
