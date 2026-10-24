import chalk from 'chalk';
import { theme } from './theme';

export interface ProgressStep {
  id: number;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  durationMs?: number;
}

const icons: Record<string, (label: string, step?: ProgressStep) => string> = {
  pending: (label) => chalk.dim(`  ○ ${label}`),
  running: (label) => chalk.hex('#39FF14')(`  ● ${label}`) + chalk.dim(' ...'),
  done: (label, step) => {
    const dur = step?.durationMs ? chalk.dim(` ${(step.durationMs / 1000).toFixed(1)}s`) : '';
    return chalk.hex('#39FF14')(`  ✓ ${label}`) + dur;
  },
  error: (label) => chalk.red(`  ✗ ${label}`),
};

export function renderStep(step: ProgressStep): string {
  return icons[step.status](step.label, step);
}

export function renderSteps(steps: ProgressStep[]): string {
  return steps.map(renderStep).join('\n');
}

export function renderSummary(
  tokensUsed: number,
  durationMs: number,
  status: 'success' | 'error' | 'partial'
): string {
  if (status === 'error') {
    return `\n  ${chalk.red('✗')} ${chalk.red('Completed with errors')}`;
  }
  if (status === 'partial') {
    return `\n  ${chalk.yellow('⚠')} ${chalk.yellow('Completed with warnings')}`;
  }
  return [
    '',
    `  ${chalk.hex('#39FF14')('✔')} ${chalk.hex('#39FF14')('Complete')}`,
    '',
    `  ${chalk.dim('Tokens:')} ${chalk.cyan(tokensUsed.toLocaleString())}`,
    `  ${chalk.dim('Time:')}   ${chalk.cyan(`${(durationMs / 1000).toFixed(1)}s`)}`,
  ].join('\n');
}
