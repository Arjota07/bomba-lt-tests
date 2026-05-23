import { test, expect } from '../../fixtures/storage';

test.describe('Smoke: Homepage', () => {
  test('TC-001: homepage loads su key elements', async ({ guestPage }) => {
    const errors: string[] = [];
    guestPage.on('console', (msg: any) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const response = await guestPage.goto('/');
    expect(response?.status()).toBeLessThan(400);

    // Key landmarks visible
    await expect(guestPage.getByRole('banner')).toBeVisible();      // header
    await expect(guestPage.getByRole('main')).toBeVisible();        // main
    await expect(guestPage.getByRole('contentinfo')).toBeVisible(); // footer

    // Title contains site name
    await expect(guestPage).toHaveTitle(/bomba|muzika|cd|vinyl/i);

    // Wait for network idle
    await guestPage.waitForLoadState('networkidle', { timeout: 10_000 });

    // No critical console errors (filtuojam network errors)
    const criticalErrors = errors.filter((e) =>
      !e.includes('net::') && !e.includes('Failed to load resource')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('TC-002: search box exists ir veikia', async ({ guestPage }) => {
    await guestPage.goto('/');

    const searchBox = guestPage.getByRole('searchbox').first();
    await expect(searchBox).toBeVisible();

    await searchBox.fill('beatles');
    await searchBox.press('Enter');

    // Tikim 200 ant search rezultatų puslapio
    await guestPage.waitForLoadState('networkidle');
    const url = guestPage.url();
    expect(url).toMatch(/search|paie[šs]ka|s\?|controller=search/);
  });

  test('TC-003: footer turi link\'us', async ({ guestPage }) => {
    await guestPage.goto('/');

    const footer = guestPage.getByRole('contentinfo');
    const links = footer.getByRole('link');

    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
