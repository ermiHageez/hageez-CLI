import * as fs from 'fs';
import * as path from 'path';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-test',
  '.hageezai',
  'ai-learning',
  '.scratch',
]);

export function scanProjectFiles(root: string = process.cwd(), maxDepth: number = 4, depth: number = 0): string[] {
  const files: string[] = [];
  if (depth > maxDepth) return files;

  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...scanProjectFiles(fullPath, maxDepth, depth + 1));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {}

  return files;
}

export function filterProjectFiles(query: string, root: string = process.cwd(), maxLimit: number = 15): string[] {
  const allFiles = scanProjectFiles(root);
  const relativeFiles = allFiles.map((f) => path.relative(root, f));
  const cleanQuery = query.trim().replace(/^@/, '').toLowerCase();

  if (!cleanQuery) {
    return relativeFiles.slice(0, maxLimit);
  }

  return relativeFiles
    .filter((f) => f.toLowerCase().includes(cleanQuery))
    .slice(0, maxLimit);
}
