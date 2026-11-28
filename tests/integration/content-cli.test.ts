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
  expect(result.stdout).toContain('elements: 3\nheroes: 2\nitems: 4\nrecipes: 2\nquests: 3\nstrings: 12\ntemplates: 0 (absent)\nprogression: 1\nAbsent kinds: templates');
});

test('CLI exits one for invalid content and prints each diagnostic', () => {
  const result = runCli(fileURLToPath(new URL('invalid/duplicate-cross-kind/', fixtures)));
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('Absent kinds: heroes, recipes, quests, templates, progression');
  expect(result.stderr).toContain('items.json:$[0].id [ID_PREFIX]');
  expect(result.stderr).toContain('items.json:$[0].id [DUPLICATE_ID]');
  expect(result.stderr).toContain('Content validation failed (2 errors).');
});

test('CLI continues after malformed JSON and reports other files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'celestial-content-'));
  try {
    writeFileSync(join(dir, 'items.json'), '[');
    writeFileSync(join(dir, 'heroes.json5'), '[]');
    writeFileSync(join(dir, 'notes.txt'), '');
    writeFileSync(join(dir, 'validate.ts'), '');
    const result = runCli(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('items: unavailable');
    expect(result.stderr).toContain('items.json:$ [PARSE]');
    expect(result.stderr).toContain('heroes.json5:$ [UNKNOWN_FILE]');
    expect(result.stderr).toContain('notes.txt:$ [UNKNOWN_FILE]');
    expect(result.stderr).toContain('validate.ts:$ [UNKNOWN_FILE]');
    expect(result.stderr).toContain('Content validation failed (4 errors).');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI rejects a wrong-case content filename', () => {
  // Keep case variants in separate directories for case-insensitive filesystems.
  const dir = mkdtempSync(join(tmpdir(), 'celestial-content-case-'));
  try {
    writeFileSync(join(dir, 'Items.json'), '[]');
    const result = runCli(dir);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('items: 0 (absent)');
    expect(result.stderr).toContain('Items.json:$ [UNKNOWN_FILE]');
    expect(result.stderr).toContain('Content validation failed (1 error).');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
