import chalk from 'chalk';
import { theme } from './theme';

export interface StatusBarSection {
  label: string;
  value: string;
  color?: string;
}

export function renderStatusBar(sections: StatusBarSection[]): string {
  const cols = process.stdout.columns || 80;
  const parts = sections.map(s => {
    const val = s.color ? chalk.hex(s.color)(s.value) : chalk.cyan(s.value);
    return `${chalk.dim(s.label + ':')} ${val}`;
  });

  const separator = chalk.dim(' │ ');
  const content = parts.join(separator);
  const strippedLen = content.replace(/\u001b\[\d+m/g, '').length;
  const pad = Math.max(0, cols - strippedLen);

  return chalk.dim('─'.repeat(cols)) + '\n' + content + ' '.repeat(pad);
}

export function getStatusBarSections(opts: {
  memory?: boolean;
  project?: string;
  branch?: string;
  model?: string;
  tokens?: number;
  duration?: number;
} = {}): StatusBarSection[] {
  const sections: StatusBarSection[] = [];

  if (opts.project) {
    sections.push({ label: 'Project', value: opts.project });
  }
  if (opts.branch) {
    sections.push({ label: 'Branch', value: opts.branch, color: '#00ff88' });
  }
  if (opts.model) {
    sections.push({ label: 'Model', value: opts.model });
  }
  if (opts.tokens !== undefined) {
    sections.push({ label: 'Tokens', value: opts.tokens.toLocaleString() });
  }
  if (opts.duration !== undefined) {
    sections.push({ label: 'Time', value: `${(opts.duration / 1000).toFixed(1)}s` });
  }

  return sections;
}
