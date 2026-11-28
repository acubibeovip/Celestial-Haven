# M1 acceptance

| Check | Test file and name | Status |
| --- | --- | --- |
| T01 | `tests/e2e/m1-acceptance.spec.ts` · `T01 starts <hero name> in <mode> with its world placeholder` (10 cases) | PASS in the production iframe. Each hero starts in Starbrook Village with its own initials and element color. The cases alternate Peaceful and Adventure. |
| T02 | `tests/unit/t02-reachability.test.ts` · `T02 walks every spawn-to-exit and spawn-to-interactable BFS route with the D23 feet box` and `T02 EnterExit commits every clear arrival at least three tiles from every exit` | PASS. Five maps, 96 routes including resource and bed markers, at most 706 fixed steps per route. All eight directed exits were dispatched and their committed arrival boxes checked. |
| T17 smoke | `tests/e2e/m1-acceptance.spec.ts` · `T17 smoke keeps the canvas and joystick working through rotation and visibility changes` | PASS in Chromium touch emulation. The canvas fits at 844×390, 390×844 and 844×390 again. A joystick drag crosses an exit at each size. Simulated visibility changes leave the marker in place until normal movement resumes. |
| T18 partial | `tests/e2e/boot.spec.ts` · `renders the Boot scene from the built page in an iframe`; `tests/e2e/m1-acceptance.spec.ts` · `T18 partial starts a game and enters Farm with all network requests blocked after load` | PASS. Vite preview serves the production build at `/itch-preview/`. The offline check covers gameplay after the title loads. |

Real-device mobile is **NOT VERIFIED** and is deferred to M6-04.

Run `npm run check:m1-build` for the production checks. Run `npm test -- tests/unit/t02-reachability.test.ts --reporter=verbose --silent=false` for T02 and its route totals.
