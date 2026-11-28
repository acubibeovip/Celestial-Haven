import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { openMenu } from './openMenu';

const map = (frame: FrameLocator) => frame.getByTestId('map-name');
const prompt = (frame: FrameLocator) => frame.getByTestId('interaction-prompt');
const day = (frame: FrameLocator) => frame.getByTestId('world-day');
const xp = (frame: FrameLocator) => frame.getByTestId('world-xp');
const toast = (frame: FrameLocator) => frame.getByTestId('world-toast');

async function start(page: Page, baseURL: string | undefined, touch = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { frame, errors } = await openMenu(page, baseURL);
  const press = async (name: string) => {
    const button = frame.getByRole('button', { name, exact: true });
    if (touch) await button.tap();
    else await button.click();
  };
  await press('New Game');
  await press('Storm Monk');
  const peaceful = frame.getByRole('radio', { name: 'Peaceful' });
  if (touch) await peaceful.tap();
  else await peaceful.check();
  await press('Confirm');
  await expect(map(frame)).toHaveText('Starbrook Village');
  await expect(day(frame)).toHaveText('Day 1');
  await expect(xp(frame)).toHaveText('Lv 1 · 0/100');
  return { frame, errors };
}

async function walk(page: Page, key: string, until: () => Promise<unknown>) {
  await page.keyboard.down(key);
  try {
    await until();
  } finally {
    await page.keyboard.up(key);
  }
}

async function stepTiles(page: Page, key: string, tiles: number) {
  await walk(page, key, () => page.waitForTimeout(tiles * 250));
}

async function enter(page: Page, frame: FrameLocator, key: string, destination: string) {
  await walk(page, key, () => expect(map(frame)).toHaveText(destination, { timeout: 10_000 }));
}

async function approachOak(page: Page, frame: FrameLocator) {
  await walk(page, 'ArrowLeft', () => expect(prompt(frame)).toHaveText('E Gather Oak Log', { timeout: 3000 }));
}

async function alignWithFarmDoor(page: Page, frame: FrameLocator) {
  // The farm camera is clamped at its west edge. The hero's colored rectangle is at world x.
  const canvas = frame.locator('#game canvas');
  await walk(page, 'ArrowRight', () => expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d');
    if (!context) throw new Error('Missing canvas context.');
    const { width, height } = element;
    const pixels = context.getImageData(0, 0, width, height).data;
    let left = width;
    let right = -1;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 250 || pixels[i + 1] !== 204 || pixels[i + 2] !== 21) continue;
      const x = (i / 4) % width;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    return right < 0 ? 0 : (left + right) / 2;
  }), { intervals: [16], timeout: 3000 }).toBeGreaterThanOrEqual(204));
}

test('T03/T04 gathers once by E, cancels sleep with Esc, then sleeps and gathers after respawn', async ({ page, baseURL }, info) => {
  test.setTimeout(50_000);
  const { frame, errors } = await start(page, baseURL);
  await stepTiles(page, 'ArrowDown', 1);
  await enter(page, frame, 'ArrowLeft', 'Whisperwood');
  await approachOak(page, frame);

  await page.keyboard.press('e');
  await expect(toast(frame)).toHaveText('+2 Oak Log · +4 XP');
  await expect(xp(frame)).toHaveText('Lv 1 · 4/100');
  await expect(prompt(frame)).toHaveText('Regrows in 1 day');
  await page.screenshot({ path: info.outputPath('world-interaction-desktop.png') });
  for (let i = 0; i < 10; i++) await page.keyboard.press('e');
  await expect(toast(frame)).toHaveText('Already gathered');
  await expect(xp(frame)).toHaveText('Lv 1 · 4/100');
  await expect(prompt(frame)).toHaveText('Regrows in 1 day');

  await enter(page, frame, 'ArrowRight', 'Starbrook Village');
  await stepTiles(page, 'ArrowRight', 2);
  await stepTiles(page, 'ArrowUp', 1);
  await enter(page, frame, 'ArrowRight', 'Farm');
  await alignWithFarmDoor(page, frame);
  await walk(page, 'ArrowUp', () => expect(prompt(frame)).toHaveText('E Sleep', { timeout: 2500 }));
  await page.keyboard.press('e');
  const dialog = frame.getByRole('dialog', { name: 'Sleep until tomorrow?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'No' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Yes' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'No' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(day(frame)).toHaveText('Day 1');
  await page.keyboard.press('e');
  await dialog.getByRole('button', { name: 'Yes' }).click();
  await expect(day(frame)).toHaveText('Day 2');
  await expect(toast(frame)).toHaveText('Day 2');

  await walk(page, 'ArrowDown', async () => {
    await expect.poll(() => prompt(frame).isVisible(), { intervals: [16], timeout: 2500 }).toBe(false);
    await page.waitForTimeout(400);
  });
  await enter(page, frame, 'ArrowLeft', 'Starbrook Village');
  await stepTiles(page, 'ArrowDown', 1);
  await enter(page, frame, 'ArrowLeft', 'Whisperwood');
  await approachOak(page, frame);
  await page.keyboard.press('e');
  await expect(toast(frame)).toHaveText('+2 Oak Log · +4 XP');
  await expect(xp(frame)).toHaveText('Lv 1 · 8/100');
  expect(errors).toEqual([]);
});

test.describe('touch world interaction', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

  test('reveals the 56px Interact button only in range and gathers by touch', async ({ page, baseURL, context }, info) => {
    await page.clock.install();
    const { frame, errors } = await start(page, baseURL, true);
    const action = frame.getByRole('button', { name: 'Interact' });
    await expect(action).toBeHidden();
    const joystick = frame.getByTestId('virtual-joystick');
    const bounds = await joystick.boundingBox();
    if (!bounds) throw new Error('Missing joystick.');
    const touch = await context.newCDPSession(page);
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    async function drag(dx: number, dy: number, until: () => Promise<unknown>) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      try {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy }] });
        await until();
      } finally {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }
    try {
      // Cross one row using fixed simulation time regardless of runner scheduling.
      await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 500));
      await drag(0, 50, () => page.clock.runFor(250));
      await drag(-50, 0, async () => {
        // Stop the drag within one short simulation step of arrival.
        for (let step = 0; step < 36 && await map(frame).textContent() === 'Starbrook Village'; step++) {
          await page.clock.runFor(180);
        }
      });
      await page.clock.resume();
      await expect(map(frame)).toHaveText('Whisperwood');
      await expect(action).toBeHidden();
      await drag(-50, 0, () => expect(prompt(frame)).toHaveText('E Gather Oak Log'));
      const target = await action.boundingBox();
      expect(target?.width).toBeGreaterThanOrEqual(56);
      expect(target?.height).toBeGreaterThanOrEqual(56);
      await action.tap();
      await expect(toast(frame)).toHaveText('+2 Oak Log · +4 XP');
      await expect(xp(frame)).toHaveText('Lv 1 · 4/100');
      await expect(prompt(frame)).toHaveText('Regrows in 1 day');
      await page.screenshot({ path: info.outputPath('world-interaction-mobile.png') });
      await drag(50, 0, () => expect(action).toBeHidden());
    } finally {
      await touch.detach();
    }
    expect(errors).toEqual([]);
  });
});
