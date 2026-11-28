// ADR-017 §2 assigns each raw material to exactly one node kind.
export const rawMaterialSources: ReadonlyMap<string, 'gather' | 'mine'> = new Map([
  ['item_oak_log', 'gather'],
  ['item_resin', 'gather'],
  ['item_silverleaf', 'gather'],
  ['item_moonpetal', 'gather'],
  ['item_reed_fiber', 'gather'],
  ['item_glow_moss', 'gather'],
  ['item_soft_feather', 'gather'],
  ['item_clay', 'gather'],
  ['item_stone', 'mine'],
  ['item_coal', 'mine'],
  ['item_copper_ore', 'mine'],
  ['item_iron_ore', 'mine'],
  ['item_quartz', 'mine'],
  ['item_starlite_ore', 'mine'],
]);
