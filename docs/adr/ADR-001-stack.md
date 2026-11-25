# ADR-001 Web-first stack

Status: Proposed

Date: 2026-11-25

Celestial Haven v0.1 is a single-player HTML5 game for itch.io. The proposed stack uses Phaser for rendering, strict TypeScript, Vite with a relative build base, and Zod for future content validation. Vitest covers pure rules and Playwright exercises the built game. The MVP runs without a backend.

| Tool | Exact version |
| --- | --- |
| Node.js LTS (Lithium) | 26.13.1 |
| npm (bundled with Node) | 11.20.0 |
| Phaser | 4.2.1 |
| TypeScript | 6.0.3 |
| Vite | 8.3.8 |
| Zod | 4.6.7 |
| Vitest | 5.1.2 |
| Playwright Test | 1.65.1 |
| ESLint | 10.15.0 |
| typescript-eslint | 8.74.0 |
| globals | 17.14.0 |
| Node.js types | 26.6.10 |

TypeScript 6.0.3 is the latest stable TypeScript release within the peer dependency range supported by typescript-eslint 8.74.0 (below 6.1). The lockfile records the resolved dependency tree for clean installs.

Phaser 4.2.1 ships declaration errors under TypeScript 6.0.3. The project enables `skipLibCheck` for dependency declarations and keeps strict checking enabled for project source.
