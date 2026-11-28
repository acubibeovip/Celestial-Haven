import { expect, test } from 'vitest';
import { createContentRegistry } from '../../src/application/ContentRegistry';
import { readBundledContent } from '../../src/infrastructure/content/readBundledContent';
import { heroViewModels } from '../../src/ui/selection';

test('blocks runtime content with a dangling hero translation', () => {
  const files = readBundledContent();
  const translations = { ...files['strings.en.json'] as Record<string, unknown> };
  delete translations['hero.storm_monk.name'];
  const result = createContentRegistry({ ...files, 'strings.en.json': translations });

  expect(result).toEqual({ ok: false, error: [
    expect.objectContaining({ file: 'heroes.json', code: 'MISSING_REF', path: '$[0].nameKey' }),
  ] });
});

test('blocks an absent roster or a missing UI translation', () => {
  expect(createContentRegistry({})).toEqual({ ok: false, error: [
    expect.objectContaining({ file: 'heroes.json', code: 'SCHEMA' }),
    expect.objectContaining({ file: 'elements.json', code: 'SCHEMA' }),
    expect.objectContaining({ file: 'strings.en.json', code: 'SCHEMA' }),
    expect.objectContaining({ file: 'items.json', code: 'SCHEMA' }),
    expect.objectContaining({ file: 'templates.json', code: 'SCHEMA' }),
    expect.objectContaining({ file: 'progression.json', code: 'SCHEMA' }),
  ] });

  const files = readBundledContent();
  const translations = { ...files['strings.en.json'] as Record<string, unknown> };
  delete translations['ui.placeholder'];
  expect(createContentRegistry({ ...files, 'strings.en.json': translations })).toEqual({ ok: false, error: [
    expect.objectContaining({ file: 'strings.en.json', code: 'MISSING_REF', path: '$["ui.placeholder"]' }),
  ] });
});

test('builds all ten localized card and preview view models in roster order', () => {
  const result = createContentRegistry(readBundledContent());
  if (!result.ok) throw new Error(JSON.stringify(result.error));

  expect(heroViewModels(result.value)).toEqual([
    { id: 'hero_storm_monk', name: 'Storm Monk', initials: 'SM', archetype: 'Monk', template: 'Close', element: 'Thunder', color: '#FACC15' },
    { id: 'hero_aurora_priestess', name: 'Aurora Priestess', initials: 'AP', archetype: 'Healer', template: 'Support', element: 'Light', color: '#FFF4C2' },
    { id: 'hero_frostfox_sorceress', name: 'Frostfox Sorceress', initials: 'FS', archetype: 'Mage', template: 'Ranged', element: 'Ice', color: '#A5F3FC' },
    { id: 'hero_earthshaker_sentinel', name: 'Earthshaker Sentinel', initials: 'ES', archetype: 'Guardian', template: 'Close', element: 'Earth', color: '#D4A373' },
    { id: 'hero_galeblade_wanderer', name: 'Galeblade Wanderer', initials: 'GW', archetype: 'Wanderer', template: 'Close', element: 'Wind', color: '#5EEAD4' },
    { id: 'hero_eclipse_reaper', name: 'Eclipse Reaper', initials: 'ER', archetype: 'Reaper', template: 'Close', element: 'Dark', color: '#A78BFA' },
    { id: 'hero_tidebound_dragon_general', name: 'Tidebound Dragon General', initials: 'TDG', archetype: 'Lancer', template: 'Close', element: 'Water', color: '#60A5FA' },
    { id: 'hero_phoenix_blade_dancer', name: 'Phoenix Blade Dancer', initials: 'PBD', archetype: 'Dancer', template: 'Close', element: 'Fire', color: '#FB7185' },
    { id: 'hero_starfall_archer', name: 'Starfall Archer', initials: 'SA', archetype: 'Archer', template: 'Ranged', element: 'Astral', color: '#F0ABFC' },
    { id: 'hero_spirit_beast_warden', name: 'Spirit Beast Warden', initials: 'SBW', archetype: 'Summoner', template: 'Support', element: 'Nature', color: '#86EFAC' },
  ]);
});
