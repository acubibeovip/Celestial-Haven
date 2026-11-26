import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { isTooRecent, lockedPackages, publication, type LockedPackage } from './dep-age.ts';

const concurrency = 6;
const maxAttempts = 4;

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get('retry-after');
  if (header !== null) {
    const seconds = Number(header);
    const wait = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
    if (Number.isFinite(wait)) return Math.min(30_000, Math.max(0, wait));
  }
  return 500 * 2 ** attempt;
}

async function fetchMetadata(name: string): Promise<unknown> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return response.json();

    await response.body?.cancel();
    const retryable = response.status === 429 || (response.status >= 500 && response.status < 600);
    if (attempt + 1 === maxAttempts || !retryable) {
      throw new Error(`Registry returned HTTP ${response.status}.`);
    }
    await delay(retryDelay(response, attempt));
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function checkDependencies(): Promise<number> {
  const lockfile: unknown = JSON.parse(await readFile('package-lock.json', 'utf8'));
  const packages = lockedPackages(lockfile);
  const grouped = new Map<string, LockedPackage[]>();
  for (const pkg of packages) {
    const versions = grouped.get(pkg.name);
    if (versions) versions.push(pkg);
    else grouped.set(pkg.name, [pkg]);
  }
  const pending = grouped.entries();
  const now = Date.now();
  const offenders: string[] = [];
  const failures: string[] = [];
  let checked = 0;

  await Promise.all(Array.from({ length: Math.min(concurrency, grouped.size) }, async () => {
    // All workers share one iterator. Each takes a package name before awaiting its metadata.
    for (const [name, versions] of pending) {
      let metadata: unknown;
      try {
        metadata = await fetchMetadata(name);
      } catch (error) {
        for (const { version } of versions) failures.push(`${name}@${version}: ${describe(error)}`);
        continue;
      }
      for (const pkg of versions) checkVersion(pkg, metadata);
    }
  }));

  function checkVersion(pkg: LockedPackage, metadata: unknown): void {
    const label = `${pkg.name}@${pkg.version}`;
    try {
      const published = publication(pkg, metadata);
      checked++;
      if (isTooRecent(published, now)) offenders.push(`${label} (${published.publishedAt})`);
    } catch (error) {
      failures.push(`${label}: ${describe(error)}`);
    }
  }

  console.log(`Checked ${checked} of ${packages.length} locked package versions (minimum age: 14 days).`);
  for (const offender of offenders.sort()) console.log(`Too recent: ${offender}`);
  for (const failure of failures.sort()) console.error(`Unable to verify: ${failure}`);
  return offenders.length || failures.length ? 1 : 0;
}

try {
  process.exitCode = await checkDependencies();
} catch (error) {
  console.error(describe(error));
  process.exitCode = 1;
}
