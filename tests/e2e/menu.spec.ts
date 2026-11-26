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

async function expectReady(
  frame: FrameLocator,
  { hero, mode, weapon, stats }: { hero: string; mode: string; weapon: string; stats: number[] },
) {
  await expect(frame.getByRole('heading', { name: 'Ready' })).toBeFocused();
  await expect(frame.getByRole('heading', { name: hero })).toBeVisible();
  await expect(frame.getByText('Temporary screen while the world is in development.', { exact: false })).toBeVisible();
  await expect(frame.locator('.ready-identity dd')).toHaveText([mode, '1']);
  await expect(frame.locator('.ready-group li')).toHaveText([weapon, "Traveler's Tunic"]);
  await expect(frame.locator('.ready-group dt')).toHaveText(['Max HP', 'Max mana', 'Power', 'Guard']);
  await expect(frame.locator('.ready-group dd')).toHaveText(stats.map(String));
  await expect(frame.getByRole('button', { name: 'Back' })).toHaveCount(0);
}

test('keyboard selection starts a ranged hero and shows Ready from session state', async ({ page, baseURL }, testInfo) => {
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
  await expectReady(frame, {
    hero: 'Frostfox Sorceress', mode: 'Peaceful', weapon: 'Willow Shortbow', stats: [100, 50, 14, 8],
  });
  await page.screenshot({ path: testInfo.outputPath('ready-desktop.png') });
  await page.keyboard.press('Escape');
  await expect(frame.getByRole('heading', { name: 'Ready' })).toBeVisible();
  await page.reload();
  await expect(frame.getByRole('heading', { name: 'Celestial Haven' })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const { orientation, width, height, columns, hero, weapon, stats } of [
  { orientation: 'landscape', width: 844, height: 390, columns: 5,
    hero: 'Storm Monk', weapon: 'Training Blade', stats: [130, 30, 15, 12] },
  { orientation: 'portrait', width: 390, height: 844, columns: 2,
    hero: 'Aurora Priestess', weapon: 'Lantern Focus', stats: [110, 80, 9, 10] },
]) {
  test.describe(`mobile ${orientation}`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width, height } });

    test(`touch selection starts ${hero} and shows equipped gear and stats`, async ({ page, baseURL }, testInfo) => {
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
      await expectReady(frame, { hero, mode: 'Adventure', weapon, stats });
      if (orientation === 'portrait') {
        await page.screenshot({ path: testInfo.outputPath('ready-mobile-portrait.png') });
      }
      expect(errors).toEqual([]);
    });
  });
}

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
