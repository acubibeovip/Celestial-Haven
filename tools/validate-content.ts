import { readdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { contentFiles, contentKinds, validateContent, type ValidationError } from '../src/content/validate.ts';

const defaultDirectory = 'src/content/data';
const repositoryDataDirectory = fileURLToPath(new URL('../src/content/data', import.meta.url));

async function run(): Promise<number> {
  const { values } = parseArgs({ options: { dir: { type: 'string', default: defaultDirectory } } });
  const directory = await realpath(values.dir);
  const files: Record<string, unknown> = Object.create(null);
  const present = new Set<string>();
  const errors: ValidationError[] = [];
  const known = new Set<string>(Object.values(contentFiles));

  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) continue;
    // Git needs a marker to retain the empty repository data directory.
    if (directory === repositoryDataDirectory && entry.isFile() && entry.name === '.gitkeep') continue;
    const file = entry.name;
    present.add(file);
    if (!known.has(file)) {
      files[file] = null;
      continue;
    }
    try {
      files[file] = JSON.parse(await readFile(join(directory, file), 'utf8')) as unknown;
    } catch (error) {
      errors.push({
        file,
        path: '$',
        code: error instanceof SyntaxError ? 'PARSE' : 'SCHEMA',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const result = validateContent(files);
  if (!result.ok) errors.push(...result.error);
  for (const kind of contentKinds) {
    const file = contentFiles[kind];
    const data = files[file];
    let count: number | 'unavailable' = 'unavailable';
    if (kind === 'strings') {
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) count = Object.keys(data).length;
    } else if (Array.isArray(data)) {
      count = data.length;
    }
    console.log(`${kind}: ${present.has(file) ? count : '0 (absent)'}`);
  }
  const absent = contentKinds.filter((kind) => !present.has(contentFiles[kind]));
  console.log(`Absent kinds: ${absent.join(', ') || 'none'}`);

  for (const { file, path, code, message } of errors) {
    console.error(`${file}:${path} [${code}] ${message}`);
  }
  if (errors.length) {
    console.error(`Content validation failed (${errors.length} ${errors.length === 1 ? 'error' : 'errors'}).`);
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
