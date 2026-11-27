import { readFile, readdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { TILE_SIZE } from '../src/content/schema/map.ts';

const layouts = new URL('./blockouts/', import.meta.url);
const output = new URL('../src/content/maps/', import.meta.url);
const terrain = {
  '.': [1, 0, 0], ':': [2, 0, 0], '#': [1, 3, 1], B: [2, 4, 1], '~': [1, 5, 1],
  S: [2, 0, 0], E: [2, 6, 0],
} as const;

function generate(source: string, filename: string): string {
  const [layout, ...table] = source.trimEnd().split(/\r?\n\r?\n/);
  const records = table.join('\n');
  const rows = (layout ?? '').split(/\r?\n/).filter((line) => !line.startsWith(';'));
  const width = rows[0]?.length ?? 0;
  const height = rows.length;
  if (width === 0 || rows.some((row) => row.length !== width)) throw new Error(`${filename}: expected a rectangular layout.`);

  const points: Record<'S' | 'E', { x: number; y: number }[]> = { S: [], E: [] };
  const ground: number[] = [];
  const decor: number[] = [];
  const collision: number[] = [];
  rows.forEach((row, y) => Array.from(row).forEach((symbol, x) => {
    if (!Object.hasOwn(terrain, symbol)) throw new Error(`${filename}: unknown tile "${symbol}" at ${x},${y}.`);
    const [base, feature, solid] = terrain[symbol as keyof typeof terrain];
    ground.push(base);
    decor.push(feature);
    collision.push(solid);
    if (symbol === 'S' || symbol === 'E') points[symbol].push({ x, y });
  }));

  const objects = records.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith(';')).map((record, index) => {
    const [type, name, targetMap, targetSpawn, ...extra] = record.trim().split(/\s+/);
    if (!type || !name || extra.length || (type === 'spawn' ? targetMap !== undefined : type !== 'exit' || !targetMap || !targetSpawn)) {
      throw new Error(`${filename}: invalid marker record "${record}".`);
    }
    const point = points[type === 'spawn' ? 'S' : 'E'].shift();
    if (!point) throw new Error(`${filename}: marker record has no matching layout symbol.`);
    const property = (key: string, value: string) => ({ name: key, type: 'string', value });
    const properties = [property('type', type)];
    if (targetMap && targetSpawn) properties.push(property('targetMap', targetMap), property('targetSpawn', targetSpawn));
    return {
      id: index + 1, name, point: true, x: point.x * TILE_SIZE + 16, y: point.y * TILE_SIZE + 16,
      width: 0, height: 0, properties,
    };
  });
  if (points.S.length || points.E.length) throw new Error(`${filename}: each marker symbol needs a table record.`);

  const layer = (id: number, name: string, data: number[]) => ({
    id, name, type: 'tilelayer', width, height, x: 0, y: 0, opacity: 1,
    visible: name !== 'collision', data,
  });
  const map = {
    type: 'map', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
    width, height, tilewidth: TILE_SIZE, tileheight: TILE_SIZE,
    layers: [
      layer(1, 'ground', ground), layer(2, 'decor', decor), layer(3, 'collision', collision),
      { id: 4, name: 'markers', type: 'objectgroup', draworder: 'topdown', objects },
    ],
    tilesets: [{ firstgid: 1, name: 'placeholder', tilewidth: TILE_SIZE, tileheight: TILE_SIZE, tilecount: 6, columns: 6 }],
  };
  // Keep tile data in visual rows while leaving markers and metadata readable.
  return JSON.stringify(map, null, 2).replace(/"data": \[([\d,\s]+)\]/g, (_, data: string) => {
    const values = data.match(/\d+/g) ?? [];
    const rows = Array.from({ length: height }, (__, y) => `        ${values.slice(y * width, (y + 1) * width).join(', ')}`);
    return `"data": [\n${rows.join(',\n')}\n      ]`;
  }) + '\n';
}

const { values } = parseArgs({ options: { check: { type: 'boolean' } } });
let count = 0;
for (const name of (await readdir(layouts)).sort()) {
  if (!name.endsWith('.txt')) continue;
  const target = new URL(name.replace(/\.txt$/, '.json'), output);
  const data = generate(await readFile(new URL(name, layouts), 'utf8'), name);
  if (values.check) {
    const committed = await readFile(target, 'utf8').catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (data !== committed) {
      console.error(`Blockout drift: ${name}. Run npm run generate:maps.`);
      process.exitCode = 1;
    }
  } else {
    await writeFile(target, data);
  }
  count++;
}
console.log(`Blockouts: ${count} ${values.check ? 'checked' : 'generated'}.`);
