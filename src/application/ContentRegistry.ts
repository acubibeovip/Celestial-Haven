import { mapNameKey, requiredMapIds } from '../content/validateMap';
import type { ElementDef } from '../content/schema/element';
import type { HeroDef } from '../content/schema/hero';
import type { ItemDef } from '../content/schema/item';
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
} as const satisfies Record<SessionError, string>;

const menuKeys = [
  'ui.project_name', 'ui.title.new_game', 'ui.title.settings', 'ui.title.credits', 'ui.back',
  'ui.placeholder', 'ui.settings.reduced_motion', 'ui.settings.not_saved',
  'ui.select.title', 'ui.select.preview', 'ui.select.mode', 'ui.select.confirm',
  'ui.mode.peaceful', 'ui.mode.peaceful_description', 'ui.mode.adventure', 'ui.mode.adventure_description',
  'ui.template.close', 'ui.template.ranged', 'ui.template.support',
  'ui.content_error', ...requiredMapIds.map(mapNameKey), ...Object.values(sessionErrorKeys),
] as const;

export type ContentRegistry = {
  heroes: readonly HeroDef[];
  elements: ReadonlyMap<string, ElementDef>;
  items: ReadonlyMap<string, ItemDef>;
  templates: Readonly<Templates>;
  text: (key: string) => string;
};

export function createContentRegistry(files: Readonly<Record<string, unknown>>): Result<ContentRegistry, ValidationError[]> {
  const result = validateContent(files);
  if (!result.ok) return result;

  const errors: ValidationError[] = [];
  for (const kind of ['heroes', 'elements', 'strings', 'items', 'templates'] as const) {
    if (result.value.counts[kind] === 0) {
      errors.push({ file: contentFiles[kind], path: '$', code: 'SCHEMA', message: 'Required game content is empty or missing.' });
    }
  }
  if (errors.length) return err(errors);

  // validateContent has already checked the shapes, IDs and references.
  const heroes = files[contentFiles.heroes] as HeroDef[];
  const elements = files[contentFiles.elements] as ElementDef[];
  const items = files[contentFiles.items] as ItemDef[];
  const templates = files[contentFiles.templates] as Templates;
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
    templates,
    text: (key) => strings[key] ?? key,
  });
}
