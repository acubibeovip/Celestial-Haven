import type { ZodError, ZodType } from 'zod';
import { err, ok, type Result } from '../shared/result.ts';
import { elementSchema } from './schema/element.ts';
import { heroSchema } from './schema/hero.ts';
import { itemSchema } from './schema/item.ts';
import { progressionSchema } from './schema/progression.ts';
import { recipeSchema } from './schema/recipe.ts';
import { questSchema, type QuestDef } from './schema/quest.ts';
import { rawMaterialSources } from './rawMaterialSources.ts';
import { resourceNodeSchema } from './schema/resourceNode.ts';
import { stringsSchema } from './schema/strings.ts';
import { templatesSchema } from './schema/template.ts';

const definitions = {
  elements: { prefix: 'elem_', schema: elementSchema },
  heroes: { prefix: 'hero_', schema: heroSchema },
  items: { prefix: 'item_', schema: itemSchema },
  recipes: { prefix: 'recipe_', schema: recipeSchema },
  quests: { prefix: 'q_', schema: questSchema },
  resourceNodes: { prefix: 'res_', schema: resourceNodeSchema },
} as const;

type DefinitionKind = keyof typeof definitions;
export const contentFiles = {
  elements: 'elements.json',
  heroes: 'heroes.json',
  items: 'items.json',
  recipes: 'recipes.json',
  quests: 'quests.json',
  strings: 'strings.en.json',
  templates: 'templates.json',
  progression: 'progression.json',
  resourceNodes: 'resourceNodes.json',
} as const;

type Kind = keyof typeof contentFiles;
export const contentKinds = Object.keys(contentFiles) as Kind[];
const knownFiles = new Set<string>(Object.values(contentFiles));

export type Summary = {
  counts: Record<Kind, number>;
  absent: Kind[];
};

export type ValidationError = {
  file: string;
  path: string;
  code: 'SCHEMA' | 'ID_FORMAT' | 'ID_PREFIX' | 'DUPLICATE_ID' | 'MISSING_REF' |
    'QUEST_CYCLE' | 'UNKNOWN_FILE' | 'PARSE' | 'UNREACHABLE' | 'SPAWN_ON_EXIT' | 'SPAWN_NEAR_EXIT';
  message: string;
};

type Located<T> = { value: T; path: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issuePath(row: string, segments: PropertyKey[]): string {
  return segments.reduce<string>((path, key) => {
    if (typeof key === 'string' && /^[A-Za-z_$][\w$]*$/.test(key)) return `${path}.${key}`;
    return `${path}[${typeof key === 'number' ? key : JSON.stringify(String(key))}]`;
  }, row);
}

function checkQuestCycles(quests: Map<string, Located<QuestDef>>, errors: ValidationError[]): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  for (const [id, quest] of quests) {
    if (visited.has(id)) continue;
    const stack = [{ id, quest, next: 0 }];
    visiting.add(id);

    for (let frame = stack.at(-1); frame; frame = stack.at(-1)) {
      const index = frame.next++;
      const prereq = frame.quest.value.prereqs[index];
      if (prereq === undefined) {
        visiting.delete(frame.id);
        visited.add(frame.id);
        stack.pop();
      } else if (visiting.has(prereq)) {
        errors.push({
          file: 'quests.json',
          path: `${frame.quest.path}.prereqs[${index}]`,
          code: 'QUEST_CYCLE',
          message: `Prerequisite "${prereq}" closes a cycle.`,
        });
      } else if (!visited.has(prereq)) {
        const target = quests.get(prereq);
        if (target) {
          visiting.add(prereq);
          stack.push({ id: prereq, quest: target, next: 0 });
        }
      }
    }
  }
}

export function validateContent(files: Readonly<Record<string, unknown>>): Result<Summary, ValidationError[]> {
  const errors: ValidationError[] = [];
  const counts: Summary['counts'] = { elements: 0, heroes: 0, items: 0, recipes: 0, quests: 0, strings: 0, templates: 0, progression: 0, resourceNodes: 0 };
  const absent: Kind[] = [];
  const allIds = new Map<string, { file: string; path: string }>();
  const idsByKind: Record<DefinitionKind, Set<string>> = {
    elements: new Set(), heroes: new Set(), items: new Set(), recipes: new Set(), quests: new Set(),
    resourceNodes: new Set(),
  };

  for (const file of Object.keys(files).sort()) {
    if (!knownFiles.has(file)) {
      errors.push({ file, path: '$', code: 'UNKNOWN_FILE', message: 'Unknown content file.' });
    }
  }

  function reportSchemaErrors(file: string, path: string, { issues }: ZodError): void {
    for (const issue of issues) {
      const paths = issue.code === 'unrecognized_keys'
        ? issue.keys.map((key) => [...issue.path, key])
        : [issue.path];
      for (const segments of paths) {
        errors.push({ file, path: issuePath(path, segments), code: 'SCHEMA', message: issue.message });
      }
    }
  }

  const stringsFile = contentFiles.strings;
  let strings: Record<string, unknown> | undefined;
  if (Object.hasOwn(files, stringsFile)) {
    const source = files[stringsFile];
    const parsed = stringsSchema.safeParse(source);
    if (!parsed.success) reportSchemaErrors(stringsFile, '$', parsed.error);
    if (isRecord(source)) {
      strings = source;
      counts.strings = Object.keys(strings).length;
    }
  }

  function checkStringRefs(file: string, path: string, value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach((child: unknown, index) => checkStringRefs(file, issuePath(path, [index]), child));
    } else if (isRecord(value)) {
      for (const [field, child] of Object.entries(value)) {
        const fieldPath = issuePath(path, [field]);
        if (field.endsWith('Key') && typeof child === 'string') {
          if (!strings || !Object.hasOwn(strings, child)) {
            errors.push({
              file, path: fieldPath, code: 'MISSING_REF',
              message: `Unknown string key "${child}" in ${stringsFile}.`,
            });
          }
        } else {
          checkStringRefs(file, fieldPath, child);
        }
      }
    }
  }

  function readKind<T extends object>(kind: DefinitionKind, schema: ZodType<T>): Located<T>[] {
    const file = contentFiles[kind];
    if (!Object.hasOwn(files, file)) {
      absent.push(kind);
      return [];
    }

    const rows = files[file];
    if (!Array.isArray(rows)) {
      errors.push({ file, path: '$', code: 'SCHEMA', message: 'Expected an array of definitions.' });
      return [];
    }
    counts[kind] = rows.length;
    const entries: Located<T>[] = [];
    rows.forEach((row: unknown, index) => {
      const path = `$[${index}]`;
      const parsed = schema.safeParse(row);
      if (parsed.success) {
        entries.push({ value: parsed.data, path });
        checkStringRefs(file, path, parsed.data);
      } else {
        reportSchemaErrors(file, path, parsed.error);
      }

      if (!isRecord(row) || typeof row.id !== 'string') return;
      const id = row.id;
      const idPath = `${path}.id`;
      const prefix = definitions[kind].prefix;
      const formatValid = id.match(/^[a-z][a-z0-9_]{1,47}$/)?.[0] === id;
      if (!formatValid) {
        errors.push({ file, path: idPath, code: 'ID_FORMAT', message: `Invalid content ID "${id}".` });
      } else if (!id.startsWith(prefix)) {
        errors.push({ file, path: idPath, code: 'ID_PREFIX', message: `Expected prefix "${prefix}" on "${id}".` });
      } else {
        idsByKind[kind].add(id);
      }

      const first = allIds.get(id);
      if (first) {
        errors.push({
          file, path: idPath, code: 'DUPLICATE_ID',
          message: `ID "${id}" is already defined at ${first.file}:${first.path}.`,
        });
      } else {
        allIds.set(id, { file, path: idPath });
      }
    });
    return entries;
  }

  readKind('elements', definitions.elements.schema);
  const heroes = readKind('heroes', definitions.heroes.schema);
  const items = readKind('items', definitions.items.schema);
  const recipes = readKind('recipes', definitions.recipes.schema);
  const itemsById = new Map(items.map(({ value }) => [value.id, value]));
  const quests = readKind('quests', definitions.quests.schema);
  const resourceNodes = readKind('resourceNodes', definitions.resourceNodes.schema);
  if (!Object.hasOwn(files, stringsFile)) absent.push('strings');

  function checkRef(file: string, path: string, kind: DefinitionKind, id: string): void {
    if (!idsByKind[kind].has(id)) {
      errors.push({ file, path, code: 'MISSING_REF', message: `Unknown ID "${id}" in ${kind}.json.` });
    }
  }

  const templatesFile = contentFiles.templates;
  if (Object.hasOwn(files, templatesFile)) {
    const parsed = templatesSchema.safeParse(files[templatesFile]);
    if (!parsed.success) {
      reportSchemaErrors(templatesFile, '$', parsed.error);
    } else {
      counts.templates = Object.keys(parsed.data).length;
      checkStringRefs(templatesFile, '$', parsed.data);
      for (const [templateId, template] of Object.entries(parsed.data)) {
        for (const [slot, id] of Object.entries(template.starterGear)) {
          const path = issuePath('$', [templateId, 'starterGear', slot]);
          const item = itemsById.get(id);
          if (!item) {
            checkRef(templatesFile, path, 'items', id);
          } else if (item.kind !== 'gear' || item.gear?.slot !== slot ||
            (item.gear.template !== null && item.gear.template !== templateId)) {
            errors.push({
              file: templatesFile, path, code: 'SCHEMA',
              message: `Starter item "${id}" must be gear for slot "${slot}" and compatible with template "${templateId}".`,
            });
          }
        }
      }
    }
  } else {
    absent.push('templates');
  }

  const progressionFile = contentFiles.progression;
  if (Object.hasOwn(files, progressionFile)) {
    const parsed = progressionSchema.safeParse(files[progressionFile]);
    if (parsed.success) counts.progression = 1;
    else reportSchemaErrors(progressionFile, '$', parsed.error);
  } else {
    absent.push('progression');
  }

  // Check references independently so an invalid multiplier cannot hide an unknown ID.
  const elementRows = files['elements.json'];
  if (Array.isArray(elementRows) && Object.hasOwn(files, 'elements.json')) {
    elementRows.forEach((row: unknown, index) => {
      if (!isRecord(row) || !isRecord(row.modifiers)) return;
      for (const key of Object.keys(row.modifiers)) {
        checkRef('elements.json', issuePath(`$[${index}]`, ['modifiers', key]), 'elements', key);
      }
    });
  }

  for (const { value, path } of heroes) {
    checkRef('heroes.json', `${path}.elementId`, 'elements', value.elementId);
  }

  for (const { value, path } of recipes) {
    for (const field of ['inputs', 'outputs'] as const) {
      value[field].forEach(({ itemId }, index) => {
        checkRef('recipes.json', `${path}.${field}[${index}].itemId`, 'items', itemId);
      });
    }
  }

  const questGraph = new Map<string, Located<QuestDef>>();
  for (const quest of quests) {
    const { value, path } = quest;
    for (const field of ['prereqs', 'next'] as const) {
      value[field].forEach((id, index) => {
        checkRef('quests.json', `${path}.${field}[${index}]`, 'quests', id);
      });
    }
    value.reward.items.forEach(({ itemId }, index) => {
      checkRef('quests.json', `${path}.reward.items[${index}].itemId`, 'items', itemId);
    });
    if (idsByKind.quests.has(value.id) && !questGraph.has(value.id)) questGraph.set(value.id, quest);
  }

  for (const { value: node, path } of resourceNodes) {
    const file = contentFiles.resourceNodes;
    const itemPath = `${path}.itemId`;
    const item = itemsById.get(node.itemId);
    if (!item) {
      checkRef(file, itemPath, 'items', node.itemId);
    } else if (item.kind !== 'material' || !rawMaterialSources.has(item.id)) {
      errors.push({ file, path: itemPath, code: 'SCHEMA', message: 'Expected an ADR-017 raw material.' });
    } else if (rawMaterialSources.get(item.id) !== node.kind) {
      errors.push({ file, path: `${path}.kind`, code: 'SCHEMA', message: 'Node kind must match the material source in ADR-017.' });
    }
  }

  checkQuestCycles(questGraph, errors);
  return errors.length ? err(errors) : ok({ counts, absent });
}
