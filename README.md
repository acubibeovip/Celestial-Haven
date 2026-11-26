# Celestial Haven

Celestial Haven is a single-player HTML5 game for itch.io. The current build renders the Boot scene.

## Prerequisites

- Node.js 26.13.1 LTS, pinned in `.nvmrc` (`nvm install && nvm use`).
- npm, bundled with Node.js.

```sh
npm ci
npx playwright install chromium
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run check:deps` | Verify that every locked npm version was published at least 14 days ago. Requires access to the npm registry. |
| `npm run dev` | Start the Vite development server. |
| `npm run typecheck` | Check TypeScript in strict mode, including the separate domain check without DOM types. |
| `npm run lint` | Lint the source tree and enforce the domain import and global rules. |
| `npm test` | Run unit tests and the domain lint regression tests. |
| `npm run validate:content` | Validate game content JSON in `src/content/data/`. Pass `-- --dir <directory>` to check another directory. |
| `npm run build` | Validate content, then build the static game into `dist/`. |
| `npm run preview` | Serve the built game for local inspection. |
| `npm run test:e2e` | Test the built game in Chromium. Run `npm run build` first. |

Asset validation and itch.io packaging are deferred to M6-03 and M7-01, respectively.

## CI

GitHub Actions runs install, typecheck, lint, tests, build, and the Chromium smoke test on every pull request and push to `main`. A failed smoke test uploads its Playwright HTML report.

The separate dependency publish-age job runs on pushes to `main` and on pull requests that change `package.json` or `package-lock.json`. Run `npm run check:deps` locally from the repository root to verify the complete lockfile against the npm registry.

For a dependency add or update, edit the intended exact pins in `package.json` and resolve a fresh lockfile from that manifest with `npm install --package-lock-only --before=<UTC timestamp 14 days ago>`. Start the resolution in a directory without an existing lockfile so npm reconsiders every version. Run `npm run check:deps` against the resulting lockfile and commit it. [ADR-009](docs/adr/ADR-009-ci.md)
