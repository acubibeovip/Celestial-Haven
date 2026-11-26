import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4175';

export default defineConfig({
  testDir: './tests/dev',
  outputDir: './test-results/prototype',
  use: { baseURL, viewport: { width: 900, height: 760 } },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: baseURL,
  },
});
