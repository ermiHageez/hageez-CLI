import chalk from 'chalk';

export type DiffOperation = 'create' | 'update' | 'delete';

export interface DiffFile {
  path: string;
  operation: DiffOperation;
  additions?: string[];
  deletions?: string[];
}

const opLabels: Record<DiffOperation, (p: string) => string> = {
  create: (p) => `${chalk.green('CREATE')}  ${chalk.white(p)}`,
  update: (p) => `${chalk.yellow('UPDATE')}  ${chalk.white(p)}`,
  delete: (p) => `${chalk.red('DELETE')}  ${chalk.white(p)}`,
};

export function renderDiffFile(file: DiffFile): string {
  const lines: string[] = [];
  lines.push(`  ${opLabels[file.operation](file.path)}`);
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
