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
  await expect(status).toHaveText('Cell 48 px · Feet 208, 216 · Grid on · Collision off · Box off');
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
  await expect(status).toHaveText(`Cell 64 px · Feet 208, 216 · ${overlays}`);
  await page.screenshot({ path: testInfo.outputPath('map-prototype-cell-64.png') });

  await stage.click({ position: { x: 16, y: 16 } });
  await expect(status).toContainText('Feet 208, 216');
  await stage.click({ position: { x: 533, y: 180 } });
  await expect(status).toContainText('Feet 400, 216');
  await page.keyboard.press('KeyS');
  await expect(status).toContainText('Cell 48 px');
  await expect(page.getByTestId('virtual-joystick')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('map-prototype-touch-joystick.png') });
  expect(errors).toEqual([]);
});

test('keyboard movement advances about four tiles and stops at a wall', async ({ page }) => {
  await page.goto('/?proto');
  const status = page.locator('.prototype-status');
  await expect(status).toHaveAttribute('data-feet-x', '208');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowRight');
  const movedX = Number(await status.getAttribute('data-feet-x'));
  expect((movedX - 208) / 32).toBeGreaterThanOrEqual(3.5);
  expect((movedX - 208) / 32).toBeLessThanOrEqual(4.5);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowRight');
  expect(Number(await status.getAttribute('data-feet-x'))).toBe(438);
});

test('touch drag on the joystick moves the hero', async ({ page }) => {
  await page.goto('/?proto');
  const joystick = page.getByTestId('virtual-joystick');
  const bounds = await joystick.boundingBox();
  if (!bounds) throw new Error('Joystick is not visible.');
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  await joystick.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: centerX, clientY: centerY });
  await joystick.dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: centerX + 48, clientY: centerY });
  await page.waitForTimeout(350);
  await joystick.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: centerX + 48, clientY: centerY });
  expect(Number(await page.locator('.prototype-status').getAttribute('data-feet-x'))).toBeGreaterThan(208);
});

test('hidden time does not move or catch up on resume', async ({ page }) => {
  await page.goto('/?proto');
  const status = page.locator('.prototype-status');
  const before = Number(await status.getAttribute('data-feet-x'));
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(350);
  expect(Number(await status.getAttribute('data-feet-x'))).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(50);
  expect(Number(await status.getAttribute('data-feet-x'))).toBe(before);
});
