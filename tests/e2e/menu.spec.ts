import { expect, test, type FrameLocator, type Page } from '@playwright/test';

const roster = [
  'Storm Monk', 'Aurora Priestess', 'Frostfox Sorceress', 'Earthshaker Sentinel', 'Galeblade Wanderer',
  'Eclipse Reaper', 'Tidebound Dragon General', 'Phoenix Blade Dancer', 'Starfall Archer', 'Spirit Beast Warden',
];

async function openMenu(page: Page, baseURL: string | undefined) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  const wrapper = new URL('menu-test.html', baseURL);
  await page.route(wrapper.href, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{margin:0}iframe{display:block;width:100vw;height:100dvh;border:0}</style>
      <iframe title="Celestial Haven" src="./index.html"></iframe>`,
  }));
  await page.goto(wrapper.href);

  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: 'Celestial Haven' })).toBeVisible();
  return { frame, errors };
}

async function expectTouchTargets(frame: FrameLocator) {
  const sizes = await frame.locator('button, input[type="radio"]').evaluateAll((targets) =>
    targets.map((target) => {
      const { width, height } = target.getBoundingClientRect();
      return { width, height };
    }),
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const { width, height } of sizes) {
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  }
}

async function expectVillage(frame: FrameLocator) {
  await expect(frame.locator('#game.world-active canvas')).toBeVisible();
  await expect(frame.getByTestId('map-name')).toHaveText('Starbrook Village');
  await expect(frame.locator('#app')).toBeHidden();
}

async function observeMapFade(frame: FrameLocator): Promise<void> {
  await frame.locator('#game').evaluate((element) => {
    new MutationObserver(() => {
      element.setAttribute('data-test-fade-observed', 'true');
    }).observe(element, { attributes: true, attributeFilter: ['aria-busy'] });
  });
}

test('keyboard selection keeps arrow focus and walks Village to Farm and back', async ({ page, baseURL }) => {
  const { frame, errors } = await openMenu(page, baseURL);
  await expect(frame.getByRole('button')).toHaveText(['New Game', 'Settings', 'Credits']);
  await expectTouchTargets(frame);
  await frame.getByRole('button', { name: 'New Game' }).click();
  const cards = frame.locator('.hero-card');
  await expect(cards).toHaveCount(10);
  await expect(cards.locator('.hero-name')).toHaveText(roster);
  await expect(cards.getByText('PLACEHOLDER')).toHaveCount(10);
  const preview = frame.getByRole('complementary', { name: 'Hero preview' });
  const confirm = frame.getByRole('button', { name: 'Confirm' });
  await expect(preview.getByText('PLACEHOLDER')).toBeVisible();
  await expect(confirm).toBeDisabled();
  await expectTouchTargets(frame);

  await page.keyboard.press('Tab');
  await expect(frame.getByRole('button', { name: 'Back' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cards.first()).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(cards.last()).toBeFocused();
  await expect(preview.getByRole('heading')).toHaveText('Spirit Beast Warden');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(cards.nth(1)).toBeFocused();
  await expect(preview.getByRole('heading')).toHaveText('Aurora Priestess');
  await expect(cards.nth(1)).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(cards.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(confirm).toBeDisabled();

  const mode = frame.getByRole('radio', { name: 'Peaceful' });
  await mode.focus();
  await page.keyboard.press('Space');
  await expect(mode).toBeChecked();
  await expect(confirm).toBeEnabled();
  await confirm.press('Enter');
  await expectVillage(frame);
  const arrowPropagates = await frame.locator('#game').evaluate((host) => {
    const dialog = document.createElement('dialog');
    const button = document.createElement('button');
    dialog.append(button);
    document.body.append(dialog);
    dialog.showModal();
    button.focus();
    const propagated = button.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'ArrowRight', bubbles: true, cancelable: true,
    }));
    dialog.close();
    dialog.remove();
    host.focus();
    return propagated;
  });
  expect(arrowPropagates).toBe(true);


  const map = frame.getByTestId('map-name');
  await observeMapFade(frame);
  const busy = frame.locator('#game[aria-busy="true"]');
  await page.keyboard.down('ArrowRight');
  try {
    await expect(map).toHaveText('Farm');
    await expect(frame.locator('#game')).toHaveAttribute('data-test-fade-observed', 'true');
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await expect(busy).toHaveCount(0);
  await page.keyboard.down('ArrowLeft');
  try {
    await expect(map).toHaveText('Starbrook Village');
  } finally {
    await page.keyboard.up('ArrowLeft');
  }
  await page.reload();
  await expect(frame.getByRole('heading', { name: 'Celestial Haven' })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const { orientation, width, height, columns, hero } of [
  { orientation: 'landscape', width: 844, height: 390, columns: 5,
    hero: 'Storm Monk' },
  { orientation: 'portrait', width: 390, height: 844, columns: 2,
    hero: 'Aurora Priestess' },
]) {
  test.describe(`mobile ${orientation}`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width, height } });

    test(`touch selection starts ${hero} in Starbrook Village`, async ({ page, baseURL, context }) => {
      const { frame, errors } = await openMenu(page, baseURL);
      await expectTouchTargets(frame);
      await frame.getByRole('button', { name: 'New Game' }).tap();
      const cards = frame.locator('.hero-card');
      await expect(cards.locator('.hero-name')).toHaveText(roster);
      const gridColumns = await frame.locator('.roster').evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
      expect(gridColumns).toBe(columns);
      expect(await frame.locator('body').evaluate((body) => body.scrollWidth)).toBe(width);
      await expectTouchTargets(frame);

      const confirm = frame.getByRole('button', { name: 'Confirm' });
      await expect(confirm).toBeDisabled();
      await frame.getByRole('radio', { name: 'Adventure' }).tap();
      await expect(confirm).toBeDisabled();
      await frame.getByRole('button', { name: hero, exact: true }).tap();
      const preview = frame.getByRole('complementary', { name: 'Hero preview' });
      await expect(preview.getByRole('heading')).toHaveText(hero);
      await confirm.tap();
      await expectVillage(frame);

      if (orientation === 'landscape') {
        const joystick = frame.getByTestId('virtual-joystick');
        await expect(joystick).toBeVisible();
        const bounds = await joystick.boundingBox();
        if (!bounds) throw new Error('Joystick has no bounds.');
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height / 2;
        const touch = await context.newCDPSession(page);
        try {
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
          await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 50, y }] });
          await expect(frame.getByTestId('map-name')).toHaveText('Farm');
        } finally {
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await touch.detach();
        }
      }
      expect(errors).toEqual([]);
    });
  });
}

test('reduced motion reaches Farm without entering the fade state', async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { frame, errors } = await openMenu(page, baseURL);
  await frame.getByRole('button', { name: 'New Game' }).click();
  await frame.getByRole('button', { name: 'Storm Monk', exact: true }).click();
  await frame.getByRole('radio', { name: 'Peaceful' }).click();
  await frame.getByRole('button', { name: 'Confirm' }).click();
  await expectVillage(frame);
  await observeMapFade(frame);

  await page.keyboard.down('ArrowRight');
  try {
    await expect(frame.getByTestId('map-name')).toHaveText('Farm');
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  await expect(frame.locator('#game[aria-busy], #game[data-test-fade-observed]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Settings defaults to reduced-motion preference and retains changes only in memory', async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { frame, errors } = await openMenu(page, baseURL);
  const settings = frame.getByRole('button', { name: 'Settings' });
  await expect(settings).toHaveCSS('transition-duration', '0s');
  await settings.click();
  const toggle = frame.getByRole('switch', { name: 'Reduced motion' });
  await expect(toggle).toBeChecked();
  await expect(frame.getByText('Settings are not saved yet.')).toBeVisible();
  await expectTouchTargets(frame);
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await frame.getByRole('button', { name: 'Back' }).click();
  await expect(settings).toHaveCSS('transition-duration', '0.13s, 0.13s');
  await settings.click();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await settings.click();
  await expect(toggle).toBeChecked();
  expect(errors).toEqual([]);
});

test('Credits shows the project name and returns to Title', async ({ page, baseURL }) => {
  const { frame, errors } = await openMenu(page, baseURL);
  await frame.getByRole('button', { name: 'Credits' }).click();
  await expect(frame.getByRole('heading', { name: 'Credits' })).toBeVisible();
  await expect(frame.getByText('Celestial Haven', { exact: true })).toBeVisible();
  await expectTouchTargets(frame);
  await frame.getByRole('button', { name: 'Back' }).click();
  await expect(frame.getByRole('button', { name: 'Credits' })).toBeFocused();
  expect(errors).toEqual([]);
});
