import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { configExists, connectionConcurrency, loadConfig, probeConnection, resolveApiKey, resolveBaseUrl } from '../core';
import { theme, success, label, separator, VERSION } from '../ui/theme';
import { scanProject } from '../filesystem';
import { listDecisions } from '../memory';

export async function runDoctor(): Promise<void> {
  console.log('');
  console.log(chalk.bold.hex('#39FF14')(`  System Health Check — v${VERSION}`));
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
        label: `Default model (${config.defaultModel.connection})`,
        status: 'ok',
        detail: config.defaultModel.model,
      });
      const connections = config.connections ?? {};
      for (const [name, connection] of Object.entries(connections)) {
        const key = connection.type === 'ollama'
          ? 'local'
          : resolveApiKey(config, name) ? 'key set' : 'missing key';
        checks.push({
          label: `Connection ${name} (${connection.type})`,
          status: key === 'missing key' ? 'warn' : 'ok',
          detail: `${resolveBaseUrl(config, name) ?? 'no base URL'} · ${key} · ${connectionConcurrency(config, name)} slot(s)`,
        });
      }
      const assigned = Object.entries(config.agents ?? {});
      if (assigned.length > 0) {
        checks.push({
          label: 'Agent assignments',
          status: 'ok',
          detail: assigned.map(([agent, ref]) => `${agent}=${ref.connection}/${ref.model}`).join(', '),
        });
      }
      for (const name of Object.keys(connections)) {
        const probe = await probeConnection(config, name, { timeoutMs: 3000 });
        const users = assigned.filter(([, ref]) => ref.connection === name).map(([agent]) => agent);
        checks.push({
          label: `Connection reachability (${name})`,
          status: probe.ok ? 'ok' : 'fail',
          detail: probe.ok
            ? `${probe.models.length} model(s)${users.length ? ` · agents: ${users.join(', ')}` : ''}`
            : `${probe.error ?? 'unreachable'}${users.length ? ` · agents: ${users.join(', ')}` : ''}`,
        });
      }
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

  const decisions = listDecisions(process.cwd()).length;
  checks.push({
    label: 'Memory',
    status: decisions > 0 ? 'ok' : 'warn',
    detail: decisions > 0 ? `${decisions} Decision(s)` : 'ready; no Decisions yet',
  });

  checks.push({
    label: 'RAG',
    status: 'warn',
    detail: 'off (not implemented)',
  });

  const gitDir = path.join(process.cwd(), '.git');
  checks.push({
    label: 'Git repository',
    status: fs.existsSync(gitDir) ? 'ok' : 'warn',
    detail: fs.existsSync(gitDir) ? undefined : 'Not a git repository',
  });

  const nodeVersion = process.version;
  const [majorVersion, minorVersion] = nodeVersion.replace('v', '').split('.').map(Number);
  const nodeSupported =
    (majorVersion ?? 0) > 22 || ((majorVersion ?? 0) === 22 && (minorVersion ?? 0) >= 12);
  checks.push({
    label: `Node.js ${nodeVersion}`,
    status: nodeSupported ? 'ok' : 'fail',
    detail: nodeSupported ? undefined : 'HageezAI requires Node.js >= 22.12.0',
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
