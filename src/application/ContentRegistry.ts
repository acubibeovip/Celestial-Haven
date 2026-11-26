import type { ElementDef } from '../content/schema/element';
import type { HeroDef } from '../content/schema/hero';
import type { Strings } from '../content/schema/strings';
import { contentFiles, validateContent, type ValidationError } from '../content/validate';
import { err, ok, type Result } from '../shared/result';

const menuKeys = [
  'ui.project_name', 'ui.title.new_game', 'ui.title.settings', 'ui.title.credits', 'ui.back',
  'ui.placeholder', 'ui.settings.reduced_motion', 'ui.settings.not_saved',
  'ui.select.title', 'ui.select.preview', 'ui.select.mode', 'ui.select.confirm',
  'ui.mode.peaceful', 'ui.mode.peaceful_description', 'ui.mode.adventure', 'ui.mode.adventure_description',
  'ui.template.close', 'ui.template.ranged', 'ui.template.support',
  'ui.summary.title', 'ui.summary.temporary', 'ui.summary.hero_id', 'ui.summary.mode', 'ui.content_error',
] as const;

export type ContentRegistry = {
  heroes: readonly HeroDef[];
  elements: ReadonlyMap<string, ElementDef>;
  text: (key: string) => string;
};

export function readBundledContent(): Record<string, unknown> {
  const modules = import.meta.glob('../content/data/*.json', { eager: true, import: 'default' });
  return Object.fromEntries(Object.entries(modules).map(([path, data]) => [path.slice(path.lastIndexOf('/') + 1), data]));
}

export function createContentRegistry(files: Readonly<Record<string, unknown>>): Result<ContentRegistry, ValidationError[]> {
  const result = validateContent(files);
  if (!result.ok) return result;

  const errors: ValidationError[] = [];
  for (const kind of ['heroes', 'elements', 'strings'] as const) {
    if (result.value.counts[kind] === 0) {
      errors.push({ file: contentFiles[kind], path: '$', code: 'SCHEMA', message: 'Required menu content is empty or missing.' });
    }
  }
  if (errors.length) return err(errors);

  // validateContent has already checked the shapes, IDs and references.
  const heroes = files[contentFiles.heroes] as HeroDef[];
  const elements = files[contentFiles.elements] as ElementDef[];
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
    text: (key) => strings[key] ?? key,
  });
}
