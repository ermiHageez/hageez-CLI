import chalk from 'chalk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { theme, label, value, VERSION, separator } from './theme';
import { HageezConfig, ProjectContext, resolveApiKey, getConnection } from '../core';
import { listDecisions } from '../memory';

export interface StartupOptions {
  config?: HageezConfig;
  project?: ProjectContext;
}

export interface StartupStatusItem {
  label: string;
  ok: boolean;
  neutral?: boolean;
  detail?: string;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export function getStartupStatusItems(
  opts: StartupOptions = {},
  cwd = process.cwd()
): StartupStatusItem[] {
  const hasConfig = Boolean(opts.config);
  const hasKey = opts.config
    ? getConnection(opts.config, opts.config.defaultModel.connection).type === 'ollama' || Boolean(resolveApiKey(opts.config, opts.config.defaultModel.connection))
    : false;
  const hasGit = fs.existsSync(path.join(cwd, '.git'));
  const hasAiLearning = fs.existsSync(path.join(cwd, 'ai-learning'));

  const decisions = listDecisions(cwd).length;
  return [
    {
      label: 'Config & API key',
      ok: hasConfig && hasKey,
      detail: !hasConfig ? 'Not configured' : !hasKey ? 'No API key' : undefined,
    },
    {
      label: 'Git repository',
      ok: hasGit,
      detail: hasGit ? undefined : 'Not a git repository',
    },
    {
      label: 'ai-learning/',
      ok: hasAiLearning,
      detail: hasAiLearning ? undefined : 'Not created yet',
    },
    {
      label: 'Project loaded',
      ok: Boolean(opts.project),
      detail: opts.project ? undefined : 'Project scan unavailable',
    },
    {
      label: decisions > 0 ? `Memory ${decisions} Decision(s)` : 'Memory ready (no Decisions yet)',
      ok: decisions > 0,
      neutral: decisions === 0,
    },
    {
      label: 'RAG off (not implemented)',
      ok: false,
      neutral: true,
    },
  ];
}

function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

function renderLogo(): void {
  const figlet = require('figlet');
  const art = figlet.textSync('HAGEEZ', {
    font: 'Slant',
    horizontalLayout: 'default',
  });
  const lines = art.split('\n');
  for (const line of lines) {
    console.log('  ' + chalk.hex('#39FF14')(line));
  }
}

async function animateStatusItems(items: StartupStatusItem[]): Promise<void> {
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  for (const item of items) {
    let spinFrame = 0;
    const spinTimer = setInterval(() => {
      clearLine();
      process.stdout.write(`  ${chalk.hex('#39FF14')(spinner[spinFrame % spinner.length])} ${item.label}`);
      spinFrame++;
    }, 60);

    await delay(200);
    clearInterval(spinTimer);
    clearLine();

    const icon = item.ok
      ? chalk.hex('#39FF14')('✔')
      : chalk.dim('○');
    const detail = item.detail ? chalk.dim(` — ${item.detail}`) : '';
    process.stdout.write(`  ${icon} ${item.label}${detail}\n`);
  }
}

function renderProjectContext(project?: ProjectContext): string {
  if (!project || (project.filesScanned === 0 && !project.language && !project.framework)) {
    return [
      '',
      label('  Project  : ') + value('No project found here'),
    ].join('\n');
  }
  return [
    '',
    label('  Project  : ') + value(project.name),
    label('  Framework: ') + value(project.framework ?? 'unknown'),
    label('  Language : ') + value(project.language ?? 'unknown'),
    label('  Database : ') + value(project.database ?? 'unknown'),
    label('  Branch   : ') + theme.green(project.branch ?? 'unknown'),
  ].join('\n');
}

function renderTips(): string {
  const tips = [
    'Type / for commands menu',
    'Type @ for file browser',
    'Press Tab to switch build/plan mode',
    'Ask questions, edit files, run commands',
  ];
  return [
    '',
    label('  Tips'),
    '',
    ...tips.map(t => `  ${chalk.dim('•')} ${chalk.white(t)}`),
  ].join('\n');
}

function renderFooter(project?: ProjectContext, config?: HageezConfig): string {
  const isProj = Boolean(project && (project.filesScanned > 0 || project.language || project.framework));
  const cwd = isProj ? process.cwd().replace(os.homedir(), '~') : 'No project found here';
  const branch = project?.branch ?? 'main';
  const model = config?.defaultModel?.model ?? 'HageezAI-v1';
  return [
    separator(),
    `  ${chalk.dim('Project:')} ${chalk.white(cwd)}`,
    `  ${chalk.dim('Branch:')}   ${chalk.green(branch)}`,
    `  ${chalk.dim('Model:')}    ${chalk.cyan(model)}`,
    `  ${chalk.dim('Writes:')}   ${chalk.yellow('direct (review changes with git)')}`,
    `  ${chalk.dim('Mode:')}     ${chalk.hex('#39FF14')('build')} ${chalk.dim('|')} ${chalk.cyan('plan')}  ${chalk.dim('(Tab to switch)')}`,
  ].join('\n');
}

export async function runStartup(opts: StartupOptions = {}): Promise<void> {
  console.clear();
  console.log('');

  // Render logo
  renderLogo();
  console.log('');
  console.log('  ' + chalk.dim('AI Software Engineering Assistant'));
  console.log('  ' + chalk.dim(`v${VERSION}`));
  console.log('');

  // Animate status items
  await animateStatusItems(getStartupStatusItems(opts));

  // Project context
  const ctx = renderProjectContext(opts.project);
  if (ctx) console.log(ctx);

  // Tips
  console.log(renderTips());
  console.log('');
  console.log(renderFooter(opts.project, opts.config));
  console.log('');
}
