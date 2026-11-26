import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const cli = fileURLToPath(new URL('../../tools/validate-maps.ts', import.meta.url));
const fixtures = new URL('../fixtures/maps/', import.meta.url);

function run(directory: string) {
  return spawnSync(process.execPath, [cli, '--dir', directory], { encoding: 'utf8', timeout: 10_000 });
}

test('map CLI exits 0 for a valid set and 1 for a missing exit target', () => {
  const valid = run(fileURLToPath(new URL('valid/', fixtures)));
  expect(valid.status).toBe(0);
  expect(valid.stdout).toContain('Maps: 2 validated.');
  expect(valid.stderr).toBe('');

  const invalid = run(fileURLToPath(new URL('invalid/unknown-map/', fixtures)));
  expect(invalid.status).toBe(1);
  expect(invalid.stderr).toContain('map_fixture.json:$.layers[3].objects[1].properties[1].value [MISSING_REF]');
});

test('map CLI reports both empty and missing directories as optional', () => {
  const directory = mkdtempSync(join(tmpdir(), 'celestial-maps-'));
  try {
    const empty = run(directory);
    expect(empty.status).toBe(0);
    expect(empty.stdout).toContain('Maps: 0. No map files');
    const missing = run(join(directory, 'missing'));
    expect(missing.status).toBe(0);
    expect(missing.stdout).toContain('is absent. Maps are optional');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
