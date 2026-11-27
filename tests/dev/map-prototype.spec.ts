import { expect, test } from '@playwright/test';

test.use({ hasTouch: true });

test('captures both sprite cells with collision and feet overlays', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?proto');
  const status = page.locator('.prototype-status');
  await expect(status).toHaveText('Cell 48 px · Feet 208, 208 · Grid on · Collision off · Box off');
  const stage = page.locator('.prototype-stage canvas');
  await expect(stage).toBeVisible();

  await page.keyboard.press('KeyG');
  await expect(status).toContainText('Grid off');
  await page.keyboard.press('KeyG');
  await page.keyboard.press('KeyC');
  await page.keyboard.press('KeyB');
  const overlays = 'Grid on · Collision on · Box on';
  await expect(status).toContainText(overlays);
  await page.screenshot({ path: testInfo.outputPath('map-prototype-cell-48.png') });
  await page.keyboard.press('KeyS');
  await expect(status).toHaveText(`Cell 64 px · Feet 208, 208 · ${overlays}`);
  await page.screenshot({ path: testInfo.outputPath('map-prototype-cell-64.png') });

  await stage.click({ position: { x: 16, y: 16 } });
  await expect(status).toContainText('Feet 208, 208');
  await stage.tap({ position: { x: 462, y: 270 } });
  await expect(status).toContainText('Feet 464, 272');
  await page.keyboard.press('KeyS');
  await expect(status).toContainText('Cell 48 px');
  expect(errors).toEqual([]);
});
