import { expect, type Page } from '@playwright/test';

export async function openMenu(page: Page, baseURL: string | undefined) {
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
