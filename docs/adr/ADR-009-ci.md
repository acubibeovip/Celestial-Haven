# ADR-009 GitHub Actions CI and dependency publish age

Status: Proposed

Date: 2026-11-26

GitHub Actions runs the local project gates on every pull request and push to main. The dependency-age job runs on pushes to main and on pull requests whose package manifest or lockfile changed. Pull request changes are compared against the PR merge base.

npm and Node use the versions selected by the repository's `.nvmrc`. Playwright uses Chromium and uploads its HTML report after a failed smoke test. The workflow uses read-only repository permissions and cancels superseded runs for the same ref.

## Action pins

| Action | Version | Commit SHA | GitHub release published (UTC) |
| --- | --- | --- | --- |
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | 2026-07-20 15:10:05 [release](https://github.com/actions/checkout/releases/tag/v7.0.1) |
| actions/setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` | 2026-10-08 02:52:34 [release](https://github.com/actions/setup-node/releases/tag/v7.1.0) |
| actions/upload-artifact | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | 2026-10-07 10:08:14 [release](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) |

The dates are the releases' GitHub API `published_at` values. Full commit SHAs were verified against the matching tags using `git ls-remote`. Each pinned release was at least 14 days old on 2026-11-26.

## npm lockfile gate

The checker reads all non-root lockfile entries, deduplicates identical package names and versions, and verifies their timestamps against the public npm registry. This includes transitive and platform-specific optional packages. Each version must be at least 14 full days old when the check starts. An unsupported lockfile entry, missing timestamp, or failed registry request fails the gate. The tool retries HTTP 429, HTTP 5xx, and transient network failures such as timeouts and bounds concurrent requests.

## D8 Lockfile re-resolution

For every dependency addition or update, update the intended direct pins, then resolve a fresh lockfile with `npm install --package-lock-only --before=<UTC timestamp 14 days before resolution>`. Resolve from the updated manifest without a pre-existing lockfile so npm reconsiders every version. Run `npm run check:deps` and commit the resulting lockfile. The gate applies to every locked version.

PR #4 applied D8 with `--before=2026-11-12T15:50:35Z` UTC, preserving every direct pin.
