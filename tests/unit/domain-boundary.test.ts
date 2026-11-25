import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';
import { expect, test } from 'vitest';

const eslint = new ESLint();

async function lintFixture(name: string) {
  const fixture = new URL(`../lint-fixtures/${name}.ts`, import.meta.url);
  const source = await readFile(fixture, 'utf8');
  const [result] = await eslint.lintText(source, {
    filePath: `src/domain/${name}.ts`,
  });

  if (!result) throw new Error(`ESLint produced no result for ${name}`);
  return result.messages.map(({ ruleId, line, severity }) => ({ ruleId, line, severity }));
}

test('rejects engine and storage imports and browser globals in domain code', async () => {
  expect(await lintFixture('domain-violation')).toEqual([
    { ruleId: 'no-restricted-imports', line: 1, severity: 2 },
    { ruleId: 'no-restricted-imports', line: 2, severity: 2 },
    { ruleId: 'no-restricted-globals', line: 4, severity: 2 },
    { ruleId: 'no-restricted-globals', line: 5, severity: 2 },
    { ruleId: 'no-restricted-globals', line: 6, severity: 2 },
  ]);
});

test('accepts a pure shared import in domain code', async () => {
  expect(await lintFixture('domain-clean')).toEqual([]);
});
