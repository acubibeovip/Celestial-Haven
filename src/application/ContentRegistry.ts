import { mapNameKey, requiredMapIds } from '../content/validateMap';
import type { ElementDef } from '../content/schema/element';
import type { HeroDef } from '../content/schema/hero';
import type { ItemDef } from '../content/schema/item';
import type { RecipeDef } from '../content/schema/recipe';
import type { ResourceNodeDef } from '../content/schema/resourceNode';
import type { ProgressionDef } from '../content/schema/progression';
import type { Templates } from '../content/schema/template';
import type { SessionError } from './GameSession';
import type { Strings } from '../content/schema/strings';
import { contentFiles, validateContent, type ValidationError } from '../content/validate';
import { err, ok, type Result } from '../shared/result';

export type { ValidationError } from '../content/validate';

export const sessionErrorKeys = {
  UNKNOWN_HERO: 'ui.new_game_error.unknown_hero',
  UNKNOWN_TEMPLATE: 'ui.new_game_error.unknown_template',
  MISSING_STARTER_ITEM: 'ui.new_game_error.missing_starter_item',
  STARTER_ITEM_INVALID: 'ui.new_game_error.starter_item_invalid',
  ALREADY_PLAYING: 'ui.new_game_error.already_playing',
  NOT_PLAYING: 'ui.session_error.not_playing',
  UNKNOWN_EXIT: 'ui.session_error.unknown_exit',
  MISSING_CHECKPOINT: 'ui.session_error.missing_checkpoint',
  GEAR_NOT_IN_BAG: 'ui.session_error.gear_not_in_bag',
  GEAR_INSTANCE_MISSING: 'ui.session_error.gear_instance_missing',
  UNKNOWN_ITEM: 'ui.session_error.unknown_item',
  WRONG_ITEM_KIND: 'ui.session_error.wrong_item_kind',
  WRONG_TEMPLATE: 'ui.session_error.wrong_template',
  SLOT_EMPTY: 'ui.session_error.slot_empty',
  BAG_FULL: 'ui.session_error.bag_full',
  REQUIREMENT_UNSUPPORTED: 'ui.session_error.requirement_unsupported',
  UNKNOWN_RECIPE: 'ui.session_error.unknown_recipe',
  NO_STATION_ON_MAP: 'ui.session_error.no_station_on_map',
  UNKNOWN_NODE: 'ui.session_error.unknown_node',
  NODE_DEPLETED: 'ui.session_error.node_depleted',
  NO_BED_ON_MAP: 'ui.session_error.no_bed_on_map',
  NODE_NOT_ON_MAP: 'ui.session_error.node_not_on_map',
  INVALID_XP_AMOUNT: 'ui.session_error.invalid_xp_amount',
  INVALID_QUANTITY: 'ui.session_error.invalid_quantity',
  INSUFFICIENT_ITEMS: 'ui.session_error.insufficient_items',
  INVALID_SLOT: 'ui.session_error.invalid_slot',
} as const satisfies Record<SessionError, string>;

const menuKeys = [
  'ui.project_name', 'ui.title.new_game', 'ui.title.settings', 'ui.title.credits', 'ui.back',
  'ui.placeholder', 'ui.settings.reduced_motion', 'ui.settings.not_saved',
  'ui.select.title', 'ui.select.preview', 'ui.select.mode', 'ui.select.confirm',
  'ui.mode.peaceful', 'ui.mode.peaceful_description', 'ui.mode.adventure', 'ui.mode.adventure_description',
  'ui.template.close', 'ui.template.ranged', 'ui.template.support',
  'ui.world.gather', 'ui.world.mine', 'ui.world.sleep', 'ui.world.regrow_one', 'ui.world.regrow_many',
  'ui.world.interact', 'ui.world.sleep_question', 'ui.world.yes', 'ui.world.no', 'ui.world.day',
  'ui.world.xp', 'ui.world.xp_max', 'ui.world.yield', 'ui.world.level_up',
  'ui.content_error', ...requiredMapIds.map(mapNameKey), ...Object.values(sessionErrorKeys),
] as const;

export type ContentRegistry = {
  heroes: readonly HeroDef[];
  elements: ReadonlyMap<string, ElementDef>;
  items: ReadonlyMap<string, ItemDef>;
  recipes: ReadonlyMap<string, RecipeDef>;
  templates: Readonly<Templates>;
  progression: ProgressionDef;
  resourceNodes: ReadonlyMap<string, ResourceNodeDef>;
  text: (key: string) => string;
};

export function createContentRegistry(files: Readonly<Record<string, unknown>>): Result<ContentRegistry, ValidationError[]> {
  const result = validateContent(files);
  if (!result.ok) return result;

  const errors: ValidationError[] = [];
  for (const kind of ['heroes', 'elements', 'strings', 'items', 'recipes', 'templates', 'progression', 'resourceNodes'] as const) {
    if (result.value.counts[kind] === 0) {
      errors.push({ file: contentFiles[kind], path: '$', code: 'SCHEMA', message: 'Required game content is empty or missing.' });
    }
  }
  if (errors.length) return err(errors);

  // validateContent has already checked the shapes, IDs and references.
  const heroes = files[contentFiles.heroes] as HeroDef[];
  const elements = files[contentFiles.elements] as ElementDef[];
  const items = files[contentFiles.items] as ItemDef[];
  const recipes = files[contentFiles.recipes] as RecipeDef[];
  const templates = files[contentFiles.templates] as Templates;
  const nodes = files[contentFiles.resourceNodes] as ResourceNodeDef[];
  const progression = files[contentFiles.progression] as ProgressionDef;
  const strings = files[contentFiles.strings] as Strings;
  for (const key of menuKeys) {
    if (!Object.hasOwn(strings, key)) {
      errors.push({
        file: contentFiles.strings, path: `$[${JSON.stringify(key)}]`, code: 'MISSING_REF',
        message: `Required menu string "${key}" is missing.`,
      });
    }
  }
  if (errors.length) return err(errors);

  return ok({
    heroes,
    elements: new Map(elements.map((element) => [element.id, element])),
    items: new Map(items.map((item) => [item.id, item])),
    recipes: new Map(recipes.map((recipe) => [recipe.id, recipe])),
    templates,
    progression,
    resourceNodes: new Map(nodes.map((node) => [node.id, node])),
    text: (key) => strings[key] ?? key,
  });
}
