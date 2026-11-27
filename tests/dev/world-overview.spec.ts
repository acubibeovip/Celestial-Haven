import { expect, test } from '@playwright/test';

for (const [mapId, label] of [
  ['map_starbrook_village', 'Starbrook Village'],
  ['map_farm', 'Farm'],
  ['map_whisperwood', 'Whisperwood'],
  ['map_crystal_hollow', 'Crystal Hollow'],
  ['map_star_shrine', 'Star Shrine'],
] as const) {
  test(`captures the ${label} blockout overview without collision`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/__blockout-overview', (route) => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8">
        <style>
          body { margin: 0; background: #181c2c; color: #f5ebd8; font-family: Georgia, serif; }
          main { margin: auto; width: fit-content; max-width: 100vw; padding: 16px; box-sizing: border-box; }
          h1 { margin: 0 0 12px; font-size: 26px; }
          canvas { display: block; max-width: 100%; height: auto; image-rendering: pixelated; }
        </style>
        <main><h1>${label}</h1></main>
        <script type="module">
          import { loadWorldMaps, readBundledMaps } from '/src/infrastructure/maps/loadWorldMaps.ts';
          import { paintBlockout } from '/src/game/scenes/blockoutArt.ts';
          const maps = loadWorldMaps(readBundledMaps());
          if (!maps.ok) throw new Error(JSON.stringify(maps.error));
          const map = maps.value.get('${mapId}');
          if (!map) throw new Error('Missing map.');
          document.querySelector('main').append(paintBlockout('${mapId}', map.data));
        </script>`,
    }));
    await page.setViewportSize({ width: 1320, height: 1100 });
    await page.goto('/__blockout-overview');
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await page.locator('main').screenshot({ path: testInfo.outputPath(`world-map-${mapId}.png`) });
    expect(errors).toEqual([]);
  });
}
