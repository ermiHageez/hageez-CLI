import chalk from 'chalk';
import * as os from 'os';
import { theme, label, value, VERSION, separator } from './theme';
import { ProjectContext, HageezConfig } from '../core';
import { getStartupStatusItems } from './startup';
import { listDecisions } from '../memory';

export interface DashboardOptions {
  project?: ProjectContext;
  config?: HageezConfig;
  recentSessions?: Array<{ task: string; timeAgo: string }>;
}

function renderStatusIndicators(config?: HageezConfig, project?: ProjectContext): string {
  const items = getStartupStatusItems({ config, project });
  return items.map((item) => {
    const icon = item.ok ? chalk.hex('#39FF14')('✔') : chalk.dim('○');
    const detail = item.detail ? chalk.dim(` — ${item.detail}`) : '';
    return `  ${icon} ${item.label}${detail}`;
  }).join('\n');
}

function renderProjectContext(project?: ProjectContext): string {
  if (!project) {
    const cwd = process.cwd().replace(os.homedir(), '~');
    return [
      label('  Project  : ') + value(cwd),
      label('  Status   : ') + chalk.dim('No project detected'),
      '',
      chalk.dim('  Run ') + theme.primary('hageez init') + chalk.dim(' to set up.'),
    ].join('\n');
  }
  return [
    label('  Project  : ') + value(project.name),
    label('  Framework: ') + value(project.framework ?? 'unknown'),
    label('  Language : ') + value(project.language ?? 'unknown'),
    label('  Database : ') + value(project.database ?? 'unknown'),
    label('  Branch   : ') + theme.green(project.branch ?? 'unknown'),
  ].join('\n');
}

function renderTips(): string {
  const tips = [
    'Ask questions',
    'Edit files',
    'Run commands',
    'Use @filename to reference files',
    'Type /help to view commands',
  ];
  return [
    label('  Tips'),
    '',
    ...tips.map(t => `  ${chalk.dim('•')} ${chalk.white(t)}`),
  ].join('\n');
}

function renderFooter(project?: ProjectContext, config?: HageezConfig): string {
  const cwd = process.cwd().replace(os.homedir(), '~');
  const branch = project?.branch ?? 'main';
  const model = config?.defaultModel?.model ?? 'HageezAI-v1';
  return [
    separator(),
    `  ${chalk.dim('Project:')} ${chalk.white(cwd)}`,
    `  ${chalk.dim('Branch:')}   ${chalk.green(branch)}`,
    `  ${chalk.dim('Model:')}    ${chalk.cyan(model)}`,
    `  ${chalk.dim('Writes:')}   ${chalk.yellow('direct (review changes with git)')}`,
  ].join('\n');
}

export function printFullDashboard(opts: DashboardOptions = {}): void {
  const cols = process.stdout.columns || 100;

  console.clear();
  console.log('');

  // ASCII Banner
  const banner = require('figlet').textSync('HAGEEZ', {
    font: 'Slant',
    horizontalLayout: 'default',
  });
  const bannerLines = banner.split('\n').map((l: string) => chalk.hex('#39FF14')(l));
  for (const line of bannerLines) {
    console.log('  ' + line);
  }

  console.log('');
  console.log('  ' + chalk.dim('AI Software Engineering Assistant'));
  console.log('  ' + chalk.dim(`v${VERSION}`));
  console.log('');

  // Status indicators + Project context side by side
  const leftCol = renderStatusIndicators(opts.config, opts.project).split('\n');
  const rightCol = renderProjectContext(opts.project).split('\n');
  const maxRows = Math.max(leftCol.length, rightCol.length);

  for (let i = 0; i < maxRows; i++) {
    const left = (leftCol[i] || '').padEnd(30);
    const right = rightCol[i] || '';
    console.log(`  ${left}${right}`);
  }

  console.log('');

  // Tips
  console.log(renderTips());
  console.log('');
  console.log(separator());

  // Recent sessions
  if (opts.recentSessions && opts.recentSessions.length > 0) {
    console.log('');
    console.log(label('  Recent Sessions'));
    for (const s of opts.recentSessions.slice(0, 3)) {
      console.log(`  ${chalk.dim('•')} ${chalk.white(s.task.slice(0, 40).padEnd(40))}${chalk.dim(s.timeAgo)}`);
    }
  }

  console.log('');
  console.log(renderFooter(opts.project, opts.config));
  console.log('');
}

export function printProjectInfo(project: ProjectContext, config?: HageezConfig): void {
  console.log('');
  console.log(label('  Project : ') + value(project.name));
  console.log(label('  Branch  : ') + theme.green(project.branch ?? 'unknown'));
  console.log(label('  Model   : ') + value(config?.defaultModel?.model ?? 'not set'));
  const decisions = listDecisions(process.cwd()).length;
  console.log(label('  Memory  : ') + chalk.dim(decisions > 0 ? `${decisions} Decision(s)` : 'ready (no Decisions yet)'));
  console.log('');
}

export async function promptInput(prompt: string): Promise<string> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  return new Promise(resolve => {
    rl.question(
      chalk.hex('#39FF14')('>') + chalk.dim(prompt + ': '),
      answer => {
        rl.close();
        resolve(answer.trim());
      }
    );
  });
}
