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
| `npm run dev` | Start the Vite development server. |
| `npm run typecheck` | Check TypeScript in strict mode, including the separate domain check without DOM types. |
| `npm run lint` | Lint the source tree and enforce the domain import and global rules. |
| `npm test` | Run unit tests and the domain lint regression tests. |
| `npm run validate:content` | Validate content files. Pass `-- --dir <directory>` to check another directory. |
| `npm run build` | Validate content, then build the static game into `dist/`. |
| `npm run preview` | Serve the built game for local inspection. |
| `npm run test:e2e` | Test the built game in Chromium. Run `npm run build` first. |

Asset validation and itch.io packaging are deferred to M6-03 and M7-01, respectively.
