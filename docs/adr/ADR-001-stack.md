# ADR-001 Web-first stack

Status: Accepted (2026-11-25, reviewed in PR #2)

Date: 2026-11-25

Celestial Haven v0.1 is a single-player HTML5 game for itch.io. The proposed stack uses Phaser for rendering, strict TypeScript, Vite with a relative build base, and Zod for content validation in M0-05. Vitest covers pure rules and Playwright exercises the built game. The MVP runs without a backend.

Node.js is pinned to 26.13.1 LTS (Lithium) in `.nvmrc`, with bundled npm 11.20.0. The Node engine range accepts compatible releases from 26.13.1 up to (excluding) 27.

| npm package | Exact version | Published (UTC) |
| --- | --- | --- |
| phaser | 4.2.1 | 2026-07-09 |
| zod | 4.6.7 | 2026-10-12 |
| @playwright/test | 1.65.0 | 2026-11-05 |
| @types/node | 26.6.6 | 2026-10-28 |
| eslint | 10.14.0 | 2026-10-30 |
| globals | 17.14.0 | 2026-11-01 |
| typescript | 6.0.3 | 2026-04-16 |
| typescript-eslint | 8.72.2 | 2026-11-09 |
| vite | 8.3.7 | 2026-11-09 |
| vitest | 5.1.0 | 2026-11-02 |

For each package, `npm view "$package" time --json` provided the publish date of the pinned version. Direct dependencies use the newest mutually compatible stable versions published through 2026-11-10 UTC. `npm view typescript-eslint@8.72.2 peerDependencies --json` reports TypeScript `>=4.8.4 <6.1.0` and ESLint `^8.57.0 || ^9.0.0 || ^10.0.0`. Phaser 4.2.1 ships declaration errors under TypeScript 6.0.3. The project uses `skipLibCheck` for declaration files and strict checking for project source.

Domain lint rejects Zod and parent-relative imports. Use `@domain/...` for cross-module domain imports. M0-05 content schemas belong in `src/content/schema/` or `tools/`. Domain code receives plain typed objects after validation.

Renderer: to be decided in M6-03 after FPS measurement. The Boot scene temporarily uses Canvas for the pixel-sampling smoke test.
