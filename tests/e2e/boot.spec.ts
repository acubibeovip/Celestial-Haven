import { expect, test } from '@playwright/test';

test('renders the Boot scene from the built page in an iframe', async ({ page, baseURL }) => {
  // Page-level events also cover child frames.
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.setContent('<iframe title="Celestial Haven" width="500" height="290"></iframe>');
  await page.locator('iframe').evaluate((frame, url) => {
    frame.setAttribute('src', url);
  }, new URL('index.html', baseURL).href);

  const canvas = page.frameLocator('iframe').locator('canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    // The Boot scene draws white text on a dark background.
    const pixels = element.getContext('2d')?.getImageData(120, 110, 240, 50).data;
    return pixels?.some((channel, index) =>
      index % 4 === 0 && channel === 255 &&
      pixels[index + 1] === 255 && pixels[index + 2] === 255 && pixels[index + 3] === 255);
  })).toBe(true);
  expect(errors).toEqual([]);
});

test('production ignores the dev prototype query parameter', async ({ page }) => {
  await page.goto('index.html?proto');
  await expect(page.getByRole('heading', { name: 'Celestial Haven' })).toBeVisible();
  await expect(page.locator('.prototype-stage')).toHaveCount(0);
});
