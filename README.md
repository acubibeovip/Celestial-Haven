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
| `npm run generate:maps` | Regenerate provisional maps from ASCII layouts. |
| `npm run check:maps` | Compare generated maps against committed JSON without writing files. |
| `npm run validate:maps` | Validate Tiled JSON in `src/content/maps/` or a directory passed with `-- --dir <directory>`. |
| `npm run build` | Validate content and maps, then build the static game into `dist/`. |
| `npm run preview` | Serve the built game for local inspection. |
| `npm run test:prototype` | Test the dev-only map prototype and capture both sprite cell sizes. |
| `npm run test:e2e` | Test the built game in Chromium. Run `npm run build` first. |
| `npm run check:m1-build` | Build and run the M1 production smoke checks. |

Asset validation and itch.io packaging are deferred to M6-03 and M7-01, respectively.

## M1 local build check

Run `npm run check:m1-build` after installing Chromium. Playwright starts Vite preview, serves `dist/` at `http://127.0.0.1:4173/itch-preview/`, and loads the game in an iframe. The offline case blocks network requests after the title loads, then starts a New Game and walks from Starbrook Village to Farm. [M1 acceptance evidence](docs/qa/M1-acceptance.md)

## CI

GitHub Actions runs install, typecheck, lint, tests, build, and the Chromium smoke test on every pull request and push to `main`. A failed smoke test uploads its Playwright HTML report.

The separate dependency publish-age job runs on pushes to `main` and on pull requests that change `package.json` or `package-lock.json`. Run `npm run check:deps` locally from the repository root to verify the complete lockfile against the npm registry.

For a dependency add or update, edit the intended exact pins in `package.json` and resolve a fresh lockfile from that manifest with `npm install --package-lock-only --before=<UTC timestamp 14 days ago>`. Start the resolution in a directory without an existing lockfile so npm reconsiders every version. Run `npm run check:deps` against the resulting lockfile and commit it. [ADR-009](docs/adr/ADR-009-ci.md)
