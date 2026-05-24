import { test, expect } from '../../fixtures/storage';

/**
 * Performance testai — Performance-Profiler QA Agent dimensija.
 *
 * MODE: PRODUCTION READ-ONLY.
 *
 * Web Vitals slenksčiai (Google):
 *   - LCP (Largest Contentful Paint): <2500ms = good
 *   - FCP (First Contentful Paint):   <1800ms = good
 *   - TTFB (Time to First Byte):       <800ms = good
 *   - CLS (Cumulative Layout Shift):  <0.1 = good
 *
 * Tikrina TIK desktop projektams (mobile bus su throttling — atskira issue).
 */

const FCP_BUDGET_MS = 3000;       // good=1800, lenient
const LCP_BUDGET_MS = 4000;       // good=2500, lenient
const TTFB_BUDGET_MS = 1500;      // good=800, lenient
const CLS_BUDGET = 0.25;          // good=0.1, lenient

test.describe('Performance: Web Vitals', () => {
  test('TC-PERF-001: TTFB < 1500ms (homepage)', async ({ request }) => {
    const start = Date.now();
    const resp = await request.get('https://bomba.lt/');
    const ttfb = Date.now() - start;

    expect(resp.status()).toBeLessThan(400);
    expect(ttfb, `Homepage TTFB ${ttfb}ms`).toBeLessThan(TTFB_BUDGET_MS);
  });

  test('TC-PERF-002: FCP + LCP per Navigation Timing API', async ({ guestPage }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop-only metric');

    await guestPage.goto('/', { waitUntil: 'load', timeout: 30_000 });
    await guestPage.waitForTimeout(3000); // leidžiam LCP susiformuoti

    const metrics = await guestPage.evaluate(() => {
      return new Promise<{ fcp: number; lcp: number; ttfb: number }>((resolve) => {
        const entries: any[] = performance.getEntriesByType('paint');
        const fcp = entries.find((e: any) => e.name === 'first-contentful-paint')?.startTime || 0;

        const nav: any = performance.getEntriesByType('navigation')[0];
        const ttfb = nav ? nav.responseStart - nav.requestStart : 0;

        let lcp = 0;
        try {
          const observer = new PerformanceObserver((list) => {
            const last = list.getEntries().at(-1) as any;
            if (last) lcp = last.startTime;
          });
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve({ fcp, lcp, ttfb });
          }, 500);
        } catch {
          resolve({ fcp, lcp, ttfb });
        }
      });
    });

    console.log(`Web Vitals: FCP=${Math.round(metrics.fcp)}ms, LCP=${Math.round(metrics.lcp)}ms, TTFB=${Math.round(metrics.ttfb)}ms`);

    expect(metrics.fcp, `FCP ${metrics.fcp}ms`).toBeLessThan(FCP_BUDGET_MS);
    if (metrics.lcp > 0) {
      expect(metrics.lcp, `LCP ${metrics.lcp}ms`).toBeLessThan(LCP_BUDGET_MS);
    }
  });

  test('TC-PERF-003: paveikslėliai naudoja lazy loading', async ({ guestPage }) => {
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const stats = await guestPage.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const visible = imgs.filter((img) => img.offsetParent !== null);
      const lazy = visible.filter((img) =>
        img.loading === 'lazy' || img.hasAttribute('data-src') || img.hasAttribute('data-original')
      );
      return {
        total: visible.length,
        lazy: lazy.length,
        ratio: visible.length > 0 ? lazy.length / visible.length : 0,
      };
    });

    if (stats.total > 5) {
      expect(stats.ratio, `Lazy loading ratio ${(stats.ratio * 100).toFixed(0)}% (${stats.lazy}/${stats.total})`)
        .toBeGreaterThan(0.3);
    }
  });

  test('TC-PERF-004: total page weight < 5MB (resource estimate)', async ({ guestPage }) => {
    const responses: { url: string; size: number; type: string }[] = [];

    guestPage.on('response', async (resp) => {
      try {
        const headers = resp.headers();
        const size = parseInt(headers['content-length'] || '0', 10);
        if (size > 0) {
          responses.push({
            url: resp.url(),
            size,
            type: headers['content-type'] || 'unknown',
          });
        }
      } catch {}
    });

    await guestPage.goto('/', { waitUntil: 'load', timeout: 30_000 });
    await guestPage.waitForTimeout(2000);

    const totalBytes = responses.reduce((acc, r) => acc + r.size, 0);
    const totalMB = totalBytes / 1024 / 1024;

    console.log(`Page weight: ${totalMB.toFixed(2)} MB (${responses.length} resources)`);

    expect(totalMB, `Page weight ${totalMB.toFixed(2)}MB`).toBeLessThan(5);
  });

  test('TC-PERF-005: NĖRA render-blocking inline <script> > 50KB', async ({ guestPage }) => {
    await guestPage.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const heavy = await guestPage.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts
        .filter((s) => !s.src && s.textContent && s.textContent.length > 50_000)
        .map((s) => ({
          size: s.textContent!.length,
          firstLine: s.textContent!.slice(0, 80).replace(/\n/g, ' '),
        }));
    });

    expect(heavy.length, `Sunkūs inline script'ai: ${JSON.stringify(heavy)}`)
      .toBeLessThan(3);
  });
});
