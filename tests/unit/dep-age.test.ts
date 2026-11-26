import { expect, test } from 'vitest';
import { isTooRecent, lockedPackages, publication, shouldRetryRegistry } from '../../tools/dep-age.ts';

const resolved = 'https://registry.npmjs.org/example/-/example-1.0.0.tgz';

test('collects unique versions, including nested, scoped, aliased and optional packages', () => {
  expect(lockedPackages({
    packages: {
      '': { name: 'project', version: '1.0.0' },
      'node_modules/example': { version: '1.0.0', resolved },
      'node_modules/parent/node_modules/example': { version: '1.0.0', resolved },
      'node_modules/parent/node_modules/@scope/example': {
        version: '2.0.0', resolved: 'https://registry.npmjs.org/@scope/example/-/example-2.0.0.tgz', optional: true,
      },
      'node_modules/alias': {
        name: 'example', version: '1.1.0', resolved: 'https://registry.npmjs.org/example/-/example-1.1.0.tgz',
      },
    },
  })).toEqual([
    { name: 'example', version: '1.0.0' },
    { name: '@scope/example', version: '2.0.0' },
    { name: 'example', version: '1.1.0' },
  ]);
});

test('rejects a lockfile or entry whose registry version cannot be verified', () => {
  expect(() => lockedPackages({})).toThrow('packages map');
  expect(() => lockedPackages({ packages: {
    'node_modules/local': { version: '1.0.0', resolved: 'file:../local' },
  } })).toThrow('node_modules/local');
});

test('uses the exact version timestamp and accepts exactly 14 days of age', () => {
  const metadata = { time: { '1.0.0': '2026-11-12T12:00:00Z', '2.0.0': '2026-11-26T12:00:00Z' } };
  const pkg = publication({ name: 'example', version: '1.0.0' }, metadata);
  expect(pkg.publishedAt).toBe('2026-11-12T12:00:00.000Z');
  expect(isTooRecent(pkg, Date.parse('2026-11-26T11:59:59.999Z'))).toBe(true);
  expect(isTooRecent(pkg, Date.parse('2026-11-26T12:00:00.000Z'))).toBe(false);
  expect(isTooRecent(pkg, Date.parse('2026-11-27T12:00:00.000Z'))).toBe(false);
});

test('fails closed for missing or invalid registry timestamps', () => {
  const pkg = { name: 'example', version: '1.0.0' };
  expect(() => publication(pkg, { time: { '2.0.0': '2026-11-12' } })).toThrow('publish time');
  expect(() => publication(pkg, { time: { '1.0.0': 'invalid' } })).toThrow('publish time');
});

test('retries transient HTTP and network errors before the attempt cap', () => {
  const reset = Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });
  const failures = [429, 503, new TypeError('fetch failed'), reset, new DOMException('Timed out', 'TimeoutError')];

  for (const failure of failures) {
    expect(shouldRetryRegistry(1, failure)).toBe(true);
    expect(shouldRetryRegistry(3, failure)).toBe(true);
    expect(shouldRetryRegistry(4, failure)).toBe(false);
  }
  expect(shouldRetryRegistry(1, 404)).toBe(false);
  expect(shouldRetryRegistry(1, new SyntaxError('Malformed registry JSON'))).toBe(false);
});
