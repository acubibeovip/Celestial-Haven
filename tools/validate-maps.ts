import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { indexMapSpawns, validateMap } from '../src/content/validateMap.ts';
import type { ValidationError } from '../src/content/validate.ts';

async function run(): Promise<number> {
  const { values: { dir } } = parseArgs({ options: { dir: { type: 'string', default: 'src/content/maps' } } });
  const maps = new Map<string, unknown>();
  const errors: ValidationError[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    console.log(`Maps: 0. Directory "${dir}" is absent. Maps are optional at this milestone.`);
    return 0;
  }

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isDirectory() || entry.name === '.gitkeep') continue;
    const file = entry.name;
    if (!file.endsWith('.json')) {
      errors.push({ file, path: '$', code: 'UNKNOWN_FILE', message: 'Expected a Tiled JSON map.' });
      continue;
    }
    try {
      maps.set(file.slice(0, -5), JSON.parse(await readFile(join(dir, file), 'utf8')) as unknown);
    } catch (error) {
      errors.push({
        file, path: '$', code: error instanceof SyntaxError ? 'PARSE' : 'SCHEMA',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const knownMaps = indexMapSpawns(maps);
  let valid = 0;
  for (const [id, data] of maps) {
    const result = validateMap(id, data, knownMaps);
    if (result.ok) {
      const { width, height, spawns, exits } = result.value;
      console.log(`${id}: ${width} × ${height}, ${spawns} spawns, ${exits} exits.`);
      valid++;
    } else {
      errors.push(...result.error);
    }
  }
  for (const { file, path, code, message } of errors) {
    console.error(`${file}:${path} [${code}] ${message}`);
  }
  if (errors.length) {
    console.error(`Map validation failed (${errors.length} ${errors.length === 1 ? 'error' : 'errors'}).`);
    return 1;
  }
  console.log(valid ? `Maps: ${valid} validated.` : `Maps: 0. No map files in "${dir}". Maps are optional at this milestone.`);
  return 0;
}

try {
  process.exitCode = await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
