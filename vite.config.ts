import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { assetsDir: 'bundle' },
  resolve: { tsconfigPaths: true },
  test: {
    include: ['tests/{unit,integration}/**/*.test.ts'],
    passWithNoTests: false,
  },
});
