import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { elementSchema } from '../../src/content/schema/element.ts';
import { heroSchema } from '../../src/content/schema/hero.ts';

const data = new URL('../../src/content/data/', import.meta.url);

function readData(file: string): unknown {
  return JSON.parse(readFileSync(new URL(file, data), 'utf8'));
}

// Update these expectations alongside any roster change approved in ADR-010.
test('real hero roster matches ADR-010 IDs, templates, and element IDs', () => {
  const heroes = z.array(heroSchema).parse(readData('heroes.json'));
  const triples = heroes.map(({ id, template, elementId }) => [id, template, elementId]).sort();

  expect(triples).toEqual([
    ['hero_aurora_priestess', 'support', 'elem_light'],
    ['hero_eclipse_reaper', 'close', 'elem_dark'],
    ['hero_earthshaker_sentinel', 'close', 'elem_earth'],
    ['hero_frostfox_sorceress', 'ranged', 'elem_ice'],
    ['hero_galeblade_wanderer', 'close', 'elem_wind'],
    ['hero_phoenix_blade_dancer', 'close', 'elem_fire'],
    ['hero_spirit_beast_warden', 'support', 'elem_nature'],
    ['hero_starfall_archer', 'ranged', 'elem_astral'],
    ['hero_storm_monk', 'close', 'elem_thunder'],
    ['hero_tidebound_dragon_general', 'close', 'elem_water'],
  ].sort());
});

test('real elements match ADR-010 IDs and provisional active set', () => {
  const elements = z.array(elementSchema).parse(readData('elements.json'));

  expect(elements.map(({ id }) => id).sort()).toEqual([
    'elem_astral', 'elem_dark', 'elem_earth', 'elem_fire', 'elem_ice',
    'elem_light', 'elem_nature', 'elem_thunder', 'elem_water', 'elem_wind',
  ]);
  expect(elements.filter(({ active }) => active).map(({ id }) => id).sort()).toEqual([
    'elem_fire', 'elem_nature', 'elem_water',
  ]);
});
