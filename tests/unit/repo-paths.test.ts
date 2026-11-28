import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

function caseCollisions(paths: readonly string[]): string[][] {
  const byLowercase = new Map<string, string[]>();
  for (const path of paths) {
    const key = path.toLowerCase();
    const group = byLowercase.get(key);
    if (group) group.push(path);
    else byLowercase.set(key, [path]);
  }
  return [...byLowercase.values()].filter((group) => group.length > 1);
}

test('tracked repository paths have no case collisions', () => {
  const cwd = fileURLToPath(new URL('../../', import.meta.url));
  let output: string;
  try {
    output = execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8' });
  } catch (cause) {
    throw new Error('Could not list tracked paths. Ensure Git is installed, on PATH, and the tests run from a Git checkout.', { cause });
  }

  const collisions = caseCollisions(output.split('\0').filter(Boolean));
  const groups = collisions.map((paths) => JSON.stringify(paths)).join('\n');
  expect(collisions, `Tracked paths collide after lowercasing:\n${groups}`).toEqual([]);
});

test('detects in-memory paths that differ only by case', () => {
  expect(caseCollisions(['a/Items.json', 'a/items.json'])).toEqual([
    ['a/Items.json', 'a/items.json'],
  ]);
});
