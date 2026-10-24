import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { configExists, loadConfig } from '../core';
import { theme, success, label, separator } from '../ui/theme';
import { scanProject } from '../filesystem';

export async function runDoctor(): Promise<void> {
  console.log('');
  console.log(chalk.bold.hex('#39FF14')('  System Health Check'));
  console.log(separator());
  console.log('');

  const checks: Array<{ label: string; status: 'ok' | 'warn' | 'fail'; detail?: string }> = [];

  const configured = configExists();
  checks.push({
    label: 'Config file (~/.hageezai/config.json)',
    status: configured ? 'ok' : 'fail',
    detail: configured ? undefined : 'Run hageez init to configure',
  });

  let config: ReturnType<typeof loadConfig> | undefined;
  if (configured) {
    try {
      config = loadConfig();
      checks.push({
        label: `LLM Provider (${config.provider})`,
        status: 'ok',
        detail: config.model,
      });
    } catch {
      checks.push({ label: 'LLM Provider', status: 'fail', detail: 'Failed to parse config' });
    }
  }

  const aiLearningDir = path.join(process.cwd(), 'ai-learning');
  checks.push({
    label: 'ai-learning/ directory',
    status: fs.existsSync(aiLearningDir) ? 'ok' : 'warn',
    detail: fs.existsSync(aiLearningDir) ? undefined : 'Run hageez build to auto-create',
  });

  const agentsMd = path.join(process.cwd(), 'AGENTS.md');
  checks.push({
    label: 'AGENTS.md (opencode context)',
    status: fs.existsSync(agentsMd) ? 'ok' : 'warn',
    detail: fs.existsSync(agentsMd) ? undefined : 'Run hageez init to generate',
  });

  const cursorDir = path.join(process.cwd(), '.cursor');
  checks.push({
    label: '.cursor/ (Cursor IDE integration)',
    status: fs.existsSync(cursorDir) ? 'ok' : 'warn',
    detail: fs.existsSync(cursorDir) ? undefined : 'Run hageez init --cursor to generate',
  });

  const gitDir = path.join(process.cwd(), '.git');
  checks.push({
    label: 'Git repository',
    status: fs.existsSync(gitDir) ? 'ok' : 'warn',
    detail: fs.existsSync(gitDir) ? undefined : 'Not a git repository',
  });

  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0] ?? '0');
  checks.push({
    label: `Node.js ${nodeVersion}`,
    status: majorVersion >= 18 ? 'ok' : 'fail',
    detail: majorVersion >= 18 ? undefined : 'HageezAI requires Node.js >= 18',
  });

  for (const check of checks) {
    const icon =
      check.status === 'ok' ? success('✓') :
      check.status === 'warn' ? theme.yellow('⚠') :
      theme.red('✗');
    const detail = check.detail ? chalk.dim(` — ${check.detail}`) : '';
    console.log(`  ${icon} ${chalk.white(check.label)}${detail}`);
  }

  console.log('');

  try {
    const project = await scanProject(process.cwd());
    console.log(separator());
    console.log('');
    console.log(chalk.bold.hex('#39FF14')('  Project Analysis'));
    console.log('');
    console.log(label('  Name       : ') + theme.white(project.name));
    console.log(label('  Language   : ') + theme.cyan(project.language ?? 'unknown'));
    console.log(label('  Framework  : ') + theme.cyan(project.framework ?? 'unknown'));
    console.log(label('  Database   : ') + theme.cyan(project.database ?? 'unknown'));
    console.log(label('  Build Tool : ') + theme.cyan(project.buildTool ?? 'unknown'));
    console.log(label('  Files      : ') + theme.yellow(String(project.filesScanned)));
    console.log(label('  Lines      : ') + theme.yellow(project.linesOfCode.toLocaleString()));
    console.log(label('  Deps       : ') + theme.yellow(String(project.dependencies)));
  } catch {
    console.log(chalk.dim('  (Could not scan project)'));
  }

  console.log('');
}
