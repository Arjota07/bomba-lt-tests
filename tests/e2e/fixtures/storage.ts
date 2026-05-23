import { test as base, expect } from '@playwright/test';

/**
 * StorageState fixture for bomba.lt
 *
 * Prod read-only mode — naudoja TIK guest sesiją.
 * Cookie consent acceptintas iškart, kad NEblokuotų screenshot'ų.
 */

type Fixtures = {
  guestPage: any;
};

export const test = base.extend<Fixtures>({
  guestPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Auto-accept cookie banner (jei pasirodo)
    page.on('load', async () => {
      try {
        const acceptBtn = page.getByRole('button', { name: /sutinku|accept|patvirtinti/i });
        if (await acceptBtn.isVisible({ timeout: 1500 })) {
          await acceptBtn.click({ timeout: 1500 });
        }
      } catch {
        // No cookie banner — OK
      }
    });

    await use(page);
    await context.close();
  },
});

export { expect };
