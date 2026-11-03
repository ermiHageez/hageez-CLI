import chalk from 'chalk';

export type DiffOperation = 'create' | 'update' | 'delete';

export interface DiffFile {
  path: string;
  operation: DiffOperation;
  additions?: string[];
  deletions?: string[];
  truncated?: boolean;
}

export const MAX_DIFF_LINES = 400;
export const MAX_DIFF_CELLS = 1_000_000;

const opLabels: Record<DiffOperation, (p: string) => string> = {
  create: (p) => `${chalk.green('CREATE')}  ${chalk.white(p)}`,
  update: (p) => `${chalk.yellow('UPDATE')}  ${chalk.white(p)}`,
  delete: (p) => `${chalk.red('DELETE')}  ${chalk.white(p)}`,
};

function splitLines(content: string): string[] {
  if (content.length === 0) return [];
  return content.replace(/\r\n/g, '\n').split('\n');
}

function lineDiff(before: string[], after: string[]): { additions: string[]; deletions: string[] } {
  const rows = before.length;
  const cols = after.length;
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      table[i][j] = before[i] === after[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const additions: string[] = [];
  const deletions: string[] = [];
  let i = 0;
  let j = 0;

  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      deletions.push(before[i]);
      i++;
    } else {
      additions.push(after[j]);
      j++;
    }
  }

  while (i < rows) deletions.push(before[i++]);
  while (j < cols) additions.push(after[j++]);

  return { additions, deletions };
}

function coarseDiff(before: string[], after: string[]): { additions: string[]; deletions: string[] } {
  const deletionBudget = Math.min(before.length, Math.floor(MAX_DIFF_LINES / 2));
  const deletions = before.slice(0, deletionBudget);
  const additions = after.slice(0, Math.max(0, MAX_DIFF_LINES - deletions.length));
  return { additions, deletions };
}

export function createFileDiff(
  filePath: string,
  operation: DiffOperation,
  before = '',
  after = ''
): DiffFile {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  let additions: string[] = [];
  let deletions: string[] = [];
  let truncated = false;

  if (operation === 'create') {
    additions = afterLines;
  } else if (operation === 'delete') {
    deletions = beforeLines;
  } else if (before === after) {
    additions = [];
    deletions = [];
  } else if (beforeLines.length * afterLines.length > MAX_DIFF_CELLS) {
    const diff = coarseDiff(beforeLines, afterLines);
    additions = diff.additions;
    deletions = diff.deletions;
    truncated = true;
  } else {
    const diff = lineDiff(beforeLines, afterLines);
    additions = diff.additions;
    deletions = diff.deletions;
  }

  if (additions.length + deletions.length > MAX_DIFF_LINES) {
    const remaining = MAX_DIFF_LINES;
    const keptDeletions = deletions.slice(0, remaining);
    const keptAdditions = additions.slice(0, Math.max(0, remaining - keptDeletions.length));
    deletions = keptDeletions;
    additions = keptAdditions;
    truncated = true;
  }

  return {
    path: filePath,
    operation,
    additions,
    deletions,
    truncated,
  };
}

export function renderDiffFile(file: DiffFile): string {
  const lines: string[] = [];
  lines.push(`  ${opLabels[file.operation](file.path)}`);
  lines.push(chalk.dim(`  --- a/${file.path}`));
  lines.push(chalk.dim(`  +++ b/${file.path}`));
  lines.push(chalk.dim('  ' + '─'.repeat(40)));

  if (file.deletions) {
    for (const d of file.deletions) {
      lines.push(`  ${chalk.red('-')} ${chalk.red(d)}`);
    }
  }
  if (file.additions) {
    for (const a of file.additions) {
      lines.push(`  ${chalk.hex('#39FF14')('+')} ${chalk.hex('#39FF14')(a)}`);
    }
  }

  if (file.truncated) {
    lines.push(chalk.dim(`  … diff truncated at ${MAX_DIFF_LINES} lines`));
  }

  lines.push('');
  return lines.join('\n');
}

export function renderDiff(files: DiffFile[]): string {
  return files.map(renderDiffFile).join('\n');
}

export function renderInlineDiff(added: string[], removed: string[]): string {
  const lines: string[] = [];
  for (const r of removed) lines.push(`  ${chalk.red('-')} ${chalk.red(r)}`);
  for (const a of added) lines.push(`  ${chalk.hex('#39FF14')('+')} ${chalk.hex('#39FF14')(a)}`);
  return lines.join('\n');
}
