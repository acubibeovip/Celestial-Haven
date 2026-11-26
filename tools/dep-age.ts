export type LockedPackage = { name: string; version: string };
export type PublishedPackage = LockedPackage & { publishedAt: string };

const minimumAgeMs = 14 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function lockedPackages(lockfile: unknown): LockedPackage[] {
  if (!isRecord(lockfile) || !isRecord(lockfile.packages)) {
    throw new Error('Expected a package-lock.json with a packages map.');
  }

  const packages = new Map<string, LockedPackage>();
  for (const [path, entry] of Object.entries(lockfile.packages)) {
    if (path === '') continue;
    const installedName = path.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/)?.[1];
    if (!installedName || !isRecord(entry) || typeof entry.version !== 'string' || !entry.version ||
        typeof entry.resolved !== 'string' || !entry.resolved.startsWith('https://registry.npmjs.org/')) {
      throw new Error(`Cannot determine npm registry package and version at ${path}.`);
    }
    const name = typeof entry.name === 'string' ? entry.name : installedName;
    const version = entry.version;
    packages.set(`${name}@${version}`, { name, version });
  }
  return [...packages.values()];
}

export function publication(pkg: LockedPackage, metadata: unknown): PublishedPackage {
  const time = isRecord(metadata) && isRecord(metadata.time) && Object.hasOwn(metadata.time, pkg.version)
    ? metadata.time[pkg.version]
    : undefined;
  if (typeof time !== 'string' || !Number.isFinite(Date.parse(time))) {
    throw new Error('Missing or invalid registry publish time.');
  }
  return { ...pkg, publishedAt: new Date(time).toISOString() };
}

export function isTooRecent(pkg: PublishedPackage, nowMs: number): boolean {
  return nowMs - Date.parse(pkg.publishedAt) < minimumAgeMs;
}
