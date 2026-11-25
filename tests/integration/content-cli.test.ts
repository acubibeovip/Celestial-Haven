import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const cli = fileURLToPath(new URL('../../tools/validate-content.ts', import.meta.url));
const fixtures = new URL('../fixtures/content/', import.meta.url);

function runCli(directory: string) {
  return spawnSync(process.execPath, [cli, '--dir', directory], { encoding: 'utf8', timeout: 10_000 });
}

test('CLI exits zero for valid content and prints its counts', () => {
  const result = runCli(fileURLToPath(new URL('valid/', fixtures)));
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('elements: 3\nheroes: 2\nitems: 4\nrecipes: 2\nquests: 3\nAbsent kinds: none');
});

test('CLI exits one for invalid content and prints each diagnostic', () => {
  const result = runCli(fileURLToPath(new URL('invalid/duplicate-cross-kind/', fixtures)));
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('Absent kinds: heroes, recipes, quests');
  expect(result.stderr).toContain('items.json:$[0].id [ID_PREFIX]');
  expect(result.stderr).toContain('items.json:$[0].id [DUPLICATE_ID]');
  expect(result.stderr).toContain('Content validation failed (2 errors).');
});

test('CLI continues after malformed JSON and reports other files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'celestial-content-'));
  try {
    writeFileSync(join(dir, 'items.json'), '[');
    writeFileSync(join(dir, 'extra.json'), '[]');
    const result = runCli(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('items: unavailable');
    expect(result.stderr).toContain('items.json:$ [SCHEMA]');
    expect(result.stderr).toContain('extra.json:$ [UNKNOWN_FILE]');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
