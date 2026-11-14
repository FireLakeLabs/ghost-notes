import type { Page } from '@playwright/test';
/** Visit each instrument before a whole-timeline shot; off-window canvases paint on scroll. */
export async function paintTimeline(page: Page) {
  await page.evaluate(async () => {
    const top = scrollY;
    const painted = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (const heading of document.querySelectorAll('#timeline .tl-heading')) {
      heading.scrollIntoView({ block: 'start' });
      await painted();
    }
    scrollTo(0, top);
    await painted();
  });
}
