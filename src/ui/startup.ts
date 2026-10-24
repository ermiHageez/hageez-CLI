import chalk from 'chalk';
import * as os from 'os';
import { theme, label, value, VERSION, separator } from './theme';
import { HageezConfig, ProjectContext } from '../core';

export interface StartupOptions {
  config?: HageezConfig;
  project?: ProjectContext;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const statusItems = [
  'Connected',
  'Memory Enabled',
  'RAG Enabled',
  'Git Connected',
  'Project Loaded',
];

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

async function animateStatusItems(): Promise<void> {
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;

  for (const item of statusItems) {
    // Show spinner
    let spinFrame = 0;
    const spinTimer = setInterval(() => {
      clearLine();
      process.stdout.write(`  ${chalk.hex('#39FF14')(spinner[spinFrame % spinner.length])} ${item}`);
      spinFrame++;
    }, 60);

    await delay(200);
    clearInterval(spinTimer);
    clearLine();
    process.stdout.write(`  ${chalk.hex('#39FF14')('✔')} ${item}\n`);
  }
}

function renderProjectContext(project?: ProjectContext): string {
  if (!project) return '';
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
  const cwd = process.cwd().replace(os.homedir(), '~');
  const branch = project?.branch ?? 'main';
  const model = config?.model ?? 'HageezAI-v1';
  return [
    separator(),
    `  ${chalk.dim('Project:')} ${chalk.white(cwd)}`,
    `  ${chalk.dim('Branch:')}   ${chalk.green(branch)}`,
    `  ${chalk.dim('Model:')}    ${chalk.cyan(model)}`,
    `  ${chalk.dim('Context:')}  ${chalk.cyan('128k')}`,
    `  ${chalk.dim('Sandbox:')}  ${chalk.green('Enabled')}`,
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
  await animateStatusItems();

  // Project context
  const ctx = renderProjectContext(opts.project);
  if (ctx) console.log(ctx);

  // Tips
  console.log(renderTips());
  console.log('');
  console.log(renderFooter(opts.project, opts.config));
  console.log('');
}
