import { expect } from '@playwright/test';
import { test } from './helpers';
test('Ghost Notes has a valid installable standalone manifest and no music cache', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const session = await context.newCDPSession(page);
  await session.send('Page.enable');
  const manifest = await session.send('Page.getAppManifest');
  expect(manifest.errors).toEqual([]);
  const data = JSON.parse(manifest.data!);
  expect(data).toMatchObject({
    name: 'Ghost Notes',
    start_url: '/',
    scope: '/',
    display: 'standalone',
  });
  for (const icon of data.icons) {
    const size = await page.evaluate(async (src: string) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, icon.src);
    expect(icon.sizes).toBe(size.join('x'));
  }
  const installability = await session.send('Page.getInstallabilityErrors');
  expect(installability.installabilityErrors).toEqual([]);
  expect(
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
  ).toBe(0);
  expect(await page.evaluate(async () => caches.keys())).toEqual([]);
  console.log(
    'INSTALLABILITY',
    JSON.stringify({
      errors: installability.installabilityErrors,
      standalone: data.display,
      icons: data.icons.map((i: { sizes: string }) => i.sizes),
      serviceWorkers: 0,
    }),
  );
});

test('dark shell text meets AA contrast on its surfaces', async ({ page }) => {
  await page.goto('/');
  const theme = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      [
        'text',
        'muted',
        'recording',
        'mine',
        'difference',
        'canvas',
        'panel',
        'button',
        'hover',
        'toggle-on',
      ].map((name) => [name, css.getPropertyValue('--' + name).trim()]),
    );
  });
  const luminance = (hex: string) => {
    const rgb = hex
      .slice(1)
      .match(/../g)!
      .map((v) => {
        const c = parseInt(v, 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  let minimum = Infinity;
  for (const foreground of ['text', 'muted', 'recording', 'mine', 'difference'])
    for (const background of ['canvas', 'panel', 'button', 'hover', 'toggle-on']) {
      const a = luminance(theme[foreground]),
        b = luminance(theme[background]);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      minimum = Math.min(minimum, ratio);
      expect(ratio, foreground + ' on ' + background).toBeGreaterThanOrEqual(4.5);
    }
  console.log('SHELL CONTRAST', JSON.stringify({ minimum, pairs: 25 }));
});
