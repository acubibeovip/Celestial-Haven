import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { contentKinds, validateContent, type ValidationError } from '../src/content/validate.ts';

async function run(): Promise<number> {
  const { values } = parseArgs({ options: { dir: { type: 'string', default: 'src/content' } } });
  const directory = values.dir;
  const files: Record<string, unknown> = Object.create(null);
  const present = new Set<string>();
  const errors: ValidationError[] = [];
  const known = new Set<string>(contentKinds.map((kind) => `${kind}.json`));

  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory() || !entry.name.endsWith('.json')) continue;
    const file = entry.name;
    present.add(file);
    if (!known.has(file)) {
      files[file] = null;
      continue;
    }
    try {
      files[file] = JSON.parse(await readFile(join(directory, file), 'utf8')) as unknown;
    } catch (error) {
      errors.push({ file, path: '$', code: 'SCHEMA', message: error instanceof Error ? error.message : String(error) });
    }
  }

  const result = validateContent(files);
  if (!result.ok) errors.push(...result.error);
  for (const kind of contentKinds) {
    const file = `${kind}.json`;
    const rows = files[file];
    const count = Array.isArray(rows) ? rows.length : 'unavailable';
    console.log(`${kind}: ${present.has(file) ? count : '0 (absent)'}`);
  }
  const absent = contentKinds.filter((kind) => !present.has(`${kind}.json`));
  console.log(`Absent kinds: ${absent.join(', ') || 'none'}`);

  for (const { file, path, code, message } of errors) {
    console.error(`${file}:${path} [${code}] ${message}`);
  }
  if (errors.length) {
    console.error(`Content validation failed (${errors.length} errors).`);
    return 1;
  }

  console.log(contentKinds.length === absent.length
    ? 'No content files present. Missing kinds are allowed at this milestone.'
    : 'Content validation passed for the files present.');
  return 0;
}

try {
  process.exitCode = await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
