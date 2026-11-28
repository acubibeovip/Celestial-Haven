import { expect, test, type CDPSession, type FrameLocator, type Locator } from '@playwright/test';
import elements from '../../src/content/data/elements.json' with { type: 'json' };
import heroes from '../../src/content/data/heroes.json' with { type: 'json' };
import strings from '../../src/content/data/strings.en.json' with { type: 'json' };
import { openMenu } from './openMenu';

const worldCanvas = (frame: FrameLocator) => frame.locator('#game.world-active canvas');

async function startGame(
  frame: FrameLocator, hero: string, mode: 'Peaceful' | 'Adventure', tap = false,
): Promise<void> {
  const activate = (target: Locator) => tap ? target.tap() : target.click();
  await activate(frame.getByRole('button', { name: 'New Game' }));
  await activate(frame.getByRole('button', { name: hero, exact: true }));
  const radio = frame.getByRole('radio', { name: mode });
  await activate(radio);
  await expect(radio).toBeChecked();
  await activate(frame.getByRole('button', { name: 'Confirm' }));
  await expect(worldCanvas(frame)).toBeVisible();
  await expect(frame.getByTestId('map-name')).toHaveText('Starbrook Village');
}

for (const [index, hero] of heroes.entries()) {
  const mode = index % 2 === 0 ? 'Peaceful' : 'Adventure';
  const name = strings[hero.nameKey as keyof typeof strings];
  const element = elements.find(({ id }) => id === hero.elementId);
  if (!name || !element) throw new Error(`Incomplete roster data for ${hero.id}.`);
  const initials = name.split(/\s+/).map((word) => word[0]).join('');

  test(`T01 starts ${name} in ${mode} with its world placeholder`, async ({ page, baseURL }) => {
    const { frame, errors } = await openMenu(page, baseURL);
    await startGame(frame, name, mode);
    const canvas = worldCanvas(frame);
    await expect(canvas).toHaveAttribute('data-hero-initials', initials);
    await expect(canvas).toHaveAttribute('data-hero-element-color', element.color);
    expect(errors).toEqual([]);
  });
}

async function beginDrag(frame: FrameLocator, touch: CDPSession, direction: -1 | 1): Promise<void> {
  const bounds = await frame.getByTestId('virtual-joystick').boundingBox();
  if (!bounds) throw new Error('Joystick has no bounds.');
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + direction * 50, y }] });
}

async function endDrag(touch: CDPSession): Promise<void> {
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function markerXOnFarm(canvas: Locator): Promise<number> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const color = Number.parseInt(element.dataset.heroElementColor?.slice(1) ?? '', 16);
    const context = element.getContext('2d');
    if (!context || !Number.isFinite(color)) throw new Error('Cannot sample the hero marker.');

    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let left = element.width;
    let right = -1;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === (color >> 16) && pixels[i + 1] === ((color >> 8) & 255)
        && pixels[i + 2] === (color & 255) && pixels[i + 3] === 255) {
        const x = (i / 4) % element.width;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    if (right < 0) throw new Error('Hero marker is missing from the rendered farm.');
    return (left + right) / 2;
  });
}

async function setHidden(canvas: Locator, hidden: boolean): Promise<void> {
  await canvas.evaluate((element, hidden) => {
    const document = element.ownerDocument;
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: hidden ? 'hidden' : 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test.describe('touch acceptance', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' });

  test('T17 smoke keeps the canvas and joystick working through rotation and visibility changes', async ({
    page, context, baseURL,
  }) => {
    await page.clock.install();
    const { frame, errors } = await openMenu(page, baseURL);
    await startGame(frame, 'Storm Monk', 'Peaceful', true);
    const canvas = worldCanvas(frame);
    const touch = await context.newCDPSession(page);

    try {
      for (const { width, height, direction, destination } of [
        { width: 844, height: 390, direction: 1, destination: 'Farm' },
        { width: 390, height: 844, direction: -1, destination: 'Starbrook Village' },
        { width: 844, height: 390, direction: 1, destination: 'Farm' },
      ] as const) {
        await page.setViewportSize({ width, height });
        await expect.poll(async () => {
          const bounds = await canvas.boundingBox();
          return bounds !== null && bounds.x >= -1 && bounds.y >= -1
            && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1
            && Math.abs(bounds.width - bounds.height * 480 / 270) <= 2
            && (Math.abs(bounds.width - width) <= 2 || Math.abs(bounds.height - height) <= 2);
        }).toBe(true);
        await beginDrag(frame, touch, direction);
        try {
          await expect(frame.getByTestId('map-name')).toHaveText(destination, { timeout: 10_000 });
        } finally {
          await endDrag(touch);
        }
      }

      // The farm's west spawn keeps the camera clamped, so canvas pixels show actual movement.
      await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 500));
      const before = await markerXOnFarm(canvas);
      await beginDrag(frame, touch, 1);
      try {
        await setHidden(canvas, true);
        await page.clock.runFor(500);
        expect(await markerXOnFarm(canvas)).toBe(before);
        await setHidden(canvas, false);
        await page.clock.fastForward(1000);
        expect(await markerXOnFarm(canvas)).toBe(before);
        await page.clock.runFor(100);
        expect(await markerXOnFarm(canvas)).toBeGreaterThan(before);
      } finally {
        await endDrag(touch);
      }
    } finally {
      await touch.detach();
    }
    expect(errors).toEqual([]);
  });
});

test('T18 partial starts a game and enters Farm with all network requests blocked after load', async ({
  page, context, baseURL,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { frame, errors } = await openMenu(page, baseURL);
  await context.route('**/*', (route) => route.abort());
  await context.setOffline(true);
  await startGame(frame, 'Storm Monk', 'Peaceful');
  await page.keyboard.down('ArrowRight');
  try {
    await expect(frame.getByTestId('map-name')).toHaveText('Farm', { timeout: 10_000 });
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  expect(errors).toEqual([]);
});
