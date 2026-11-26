export function readBundledContent(): Record<string, unknown> {
  const modules = import.meta.glob('../../content/data/*.json', { eager: true, import: 'default' });
  return Object.fromEntries(Object.entries(modules).map(([path, data]) => [path.slice(path.lastIndexOf('/') + 1), data]));
}
