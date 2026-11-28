import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { validateContent, type ValidationError } from '../../src/content/validate.ts';

const fixtures = new URL('../fixtures/content/', import.meta.url);

function readFixture(caseName: string): Record<string, unknown> {
  const directory = new URL(`${caseName}/`, fixtures);
  return Object.fromEntries(readdirSync(directory).map((file) => [
    file,
    JSON.parse(readFileSync(new URL(file, directory), 'utf8')) as unknown,
  ]));
}

type Diagnostic = [ValidationError['code'], string, string];

const invalidCases: Record<string, Diagnostic[]> = {
  'progression-wrong-length': [['SCHEMA', 'progression.json', '$.xpToNext']],
  'progression-zero-value': [['SCHEMA', 'progression.json', '$.xpToNext[0]']],
  'progression-unknown-source': [['SCHEMA', 'progression.json', '$.xpSources.encounter']],
  'quest-item-price': [['SCHEMA', 'items.json', '$[0].price']],
  schema: [['SCHEMA', 'elements.json', '$']],
  'missing-string-key': [['MISSING_REF', 'heroes.json', '$[0].nameKey']],
  'bad-string-key': [['SCHEMA', 'strings.en.json', '$["hero.Test.name"]']],
  'empty-string-value': [['SCHEMA', 'strings.en.json', '$["hero.test.name"]']],
  'starter-wrong-slot': [['SCHEMA', 'templates.json', '$.close.starterGear.body']],
  'starter-wrong-template': [['SCHEMA', 'templates.json', '$.close.starterGear.mainHand']],
  'starter-missing-item': [['MISSING_REF', 'templates.json', '$.close.starterGear.body']],
  'template-missing-string': [['MISSING_REF', 'templates.json', '$.close.nameKey']],
  'gear-without-gear': [['SCHEMA', 'items.json', '$[0].gear']],
  'non-gear-with-gear': [['SCHEMA', 'items.json', '$[0].gear']],
  'gear-missing-tier': [['SCHEMA', 'items.json', '$[0].gear.upgradeTier']],
  'gear-stackmax': [['SCHEMA', 'items.json', '$[0].stackMax']],
  'gear-empty-stats': [['SCHEMA', 'items.json', '$[0].gear.stats']],
  'gear-negative-stat': [['SCHEMA', 'items.json', '$[0].gear.stats.power']],
  'templates-missing-key': [['SCHEMA', 'templates.json', '$.support']],
  'templates-extra-key': [['SCHEMA', 'templates.json', '$.extra']],
  'non-object-strings': [['SCHEMA', 'strings.en.json', '$']],
  'id-format': [['ID_FORMAT', 'items.json', '$[0].id']],
  'id-prefix': [['ID_PREFIX', 'items.json', '$[0].id']],
  'duplicate-id': [['DUPLICATE_ID', 'items.json', '$[1].id']],
  'duplicate-cross-kind': [
    ['ID_PREFIX', 'items.json', '$[0].id'],
    ['DUPLICATE_ID', 'items.json', '$[0].id'],
  ],
  'missing-ref': [
    ['MISSING_REF', 'heroes.json', '$[0].elementId'],
    ['MISSING_REF', 'recipes.json', '$[0].inputs[0].itemId'],
    ['MISSING_REF', 'recipes.json', '$[0].outputs[0].itemId'],
    ['MISSING_REF', 'quests.json', '$[0].prereqs[0]'],
    ['MISSING_REF', 'quests.json', '$[0].next[0]'],
    ['MISSING_REF', 'quests.json', '$[0].reward.items[0].itemId'],
  ],
  'quest-cycle': [['QUEST_CYCLE', 'quests.json', '$[1].prereqs[0]']],
  'quest-self-cycle': [['QUEST_CYCLE', 'quests.json', '$[0].prereqs[0]']],
  'unknown-file': [['UNKNOWN_FILE', 'extra.json', '$']],
  'negative-quantity': [['SCHEMA', 'recipes.json', '$[0].inputs[0].quantity']],
  'empty-recipe': [
    ['SCHEMA', 'recipes.json', '$[0].inputs'],
    ['SCHEMA', 'recipes.json', '$[0].outputs'],
  ],
  'duplicate-recipe-stacks': [
    ['SCHEMA', 'recipes.json', '$[0].inputs[1].itemId'],
    ['SCHEMA', 'recipes.json', '$[0].outputs[1].itemId'],
  ],
  'zero-objective': [['SCHEMA', 'quests.json', '$[0].objectives[0].count']],
  'element-modifiers': [
    ['SCHEMA', 'elements.json', '$[0].modifiers.banana'],
    ['MISSING_REF', 'elements.json', '$[0].modifiers.banana'],
  ],
  'noninteger-price': [['SCHEMA', 'items.json', '$[0].price']],
  'stackmax-100': [['SCHEMA', 'items.json', '$[0].stackMax']],
  'unknown-key': [['SCHEMA', 'quests.json', '$[0].reward.unexpected']],
};

test('valid content reports exact counts', () => {
  expect(validateContent(readFixture('valid'))).toEqual({
    ok: true,
    value: {
      counts: { elements: 3, heroes: 2, items: 4, recipes: 2, quests: 3, strings: 12, templates: 0, progression: 1 },
      absent: ['templates'],
    },
  });
});

test('an empty present file differs from an absent kind', () => {
  expect(validateContent({ 'items.json': [] })).toEqual({
    ok: true,
    value: {
      counts: { elements: 0, heroes: 0, items: 0, recipes: 0, quests: 0, strings: 0, templates: 0, progression: 0 },
      absent: ['elements', 'heroes', 'recipes', 'quests', 'strings', 'templates', 'progression'],
    },
  });
});

test.each(Object.entries(invalidCases))('reports exact diagnostics for %s', (name, expected) => {
  const result = validateContent(readFixture(`invalid/${name}`));
  if (result.ok) throw new Error(`Expected invalid fixture: ${name}`);
  expect(result.error.map(({ code, file, path }) => [code, file, path])).toEqual(expected);
});
