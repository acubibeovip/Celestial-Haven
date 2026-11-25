import { defineConfig } from '@playwright/test';

const previewUrl = 'http://127.0.0.1:4173/itch-preview/';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: previewUrl },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --base /itch-preview/',
    url: previewUrl,
  },
});
