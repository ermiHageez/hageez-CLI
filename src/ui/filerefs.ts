import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface FileReference {
  pattern: string;
  filePath: string;
  resolved: boolean;
  content?: string;
}

function resolveFilePath(projectRoot: string, filePath: string): { resolved: boolean; fullPath?: string; content?: string } {
  const candidates = [
    path.resolve(projectRoot, filePath),
    path.resolve(projectRoot, 'src', filePath),
    path.resolve(projectRoot, 'apps/cli/src', filePath),
    path.resolve(projectRoot, 'packages/ui/src', filePath),
    path.resolve(projectRoot, 'packages/core/src', filePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const content = fs.readFileSync(candidate, 'utf-8');
        return { resolved: true, fullPath: candidate, content };
      } catch {}
    }
  }

  return { resolved: false };
}

export function parseFileReferences(input: string, projectRoot: string): FileReference[] {
  const refs: FileReference[] = [];
  const seen = new Set<string>();

  // Pattern 1: @filename (explicit reference)
  const atPattern = /@([\w\-\.\/]+\.[\w]+)/g;
  let match;
  while ((match = atPattern.exec(input)) !== null) {
    const pattern = match[0];
    const filePath = match[1];
    if (seen.has(filePath)) continue;
    seen.add(filePath);

    const result = resolveFilePath(projectRoot, filePath);
    refs.push({
      pattern,
      filePath: result.fullPath || filePath,
      resolved: result.resolved,
      content: result.content,
    });
  }

  // Pattern 2: bare filenames like "theme.ts", "build.ts" (without @)
  const barePattern = /\b([\w\-\.\/]+\/[\w\-\.\/]+\.[\w]+)\b/g;
  while ((match = barePattern.exec(input)) !== null) {
    const filePath = match[1];
    if (seen.has(filePath)) continue;
    seen.add(filePath);

    const result = resolveFilePath(projectRoot, filePath);
    if (result.resolved) {
      refs.push({
        pattern: filePath,
        filePath: result.fullPath!,
        resolved: true,
        content: result.content,
      });
    }
  }

  // Pattern 3: just filename at start of input like "theme.ts update colors"
  const startPattern = /^([\w\-\.]+\.[\w]+)\b/;
  const startMatch = input.match(startPattern);
  if (startMatch) {
    const filePath = startMatch[1];
    if (!seen.has(filePath)) {
      seen.add(filePath);
      const result = resolveFilePath(projectRoot, filePath);
      if (result.resolved) {
        refs.push({
          pattern: filePath,
          filePath: result.fullPath!,
          resolved: true,
          content: result.content,
        });
      }
    }
  }

  return refs;
}

export function buildFileContext(refs: FileReference[]): string {
  if (refs.length === 0) return '';

  const lines: string[] = ['## Referenced Files'];
  for (const ref of refs) {
    if (ref.resolved && ref.content) {
      lines.push(`\n### ${ref.filePath}`);
      lines.push('```');
      lines.push(ref.content.slice(0, 12000));
      lines.push('```');
    } else {
      lines.push(`\n### ${ref.pattern} (not found)`);
    }
  }
  return lines.join('\n');
}

export function stripFileRefs(input: string): string {
  return input
    .replace(/@[\w\-\.\/]+\.[\w]+/g, '')
    .replace(/\b[\w\-\.\/]+\/[\w\-\.\/]+\.[\w]+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
