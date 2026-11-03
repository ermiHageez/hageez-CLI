import {
  HageezConfig,
  HageezError,
  ModelReference,
  loadConfig,
} from '../core';
import { AGENT_IDS, getAgent } from '../agents/registry';
import { assertConnectionsReady, parseAgentModel, printAgentTable } from '../agents/assignment';
import { runAgent } from '../agents/runtime';
import { theme, success, error as errorText } from '../ui/theme';

export interface AgentCommandOptions {
  dryRun?: boolean;
  agentModel?: string;
}

function load(): HageezConfig {
  try {
    return loadConfig();
  } catch (err) {
    if (err instanceof HageezError && err.code === 'CONFIG_NOT_FOUND') {
      throw new HageezError('CONFIG_NOT_FOUND', 'Run `hageez init` first.');
    }
    throw err;
  }
}

function overrideFor(name: string, raw?: string): ModelReference | undefined {
  if (!raw) return undefined;
  const separator = raw.indexOf('=');
  if (separator <= 0) {
    throw new HageezError('ASSIGNMENT_INVALID', 'Expected --agent-model <agent>=<connection>:<model>.');
  }
  if (raw.slice(0, separator) !== name) return undefined;
  return parseAgentModel(raw.slice(separator + 1));
}

export async function runAgentCommand(
  name: string,
  task: string | undefined,
  options: AgentCommandOptions = {}
): Promise<void> {
  const config = load();
  const definition = getAgent(name);
  printAgentTable(config);
  if (options.dryRun) {
    console.log(theme.cyan(`  Dry run: would run ${definition.name} — ${definition.role}.`));
    console.log('');
    return;
  }
  if (!task?.trim()) {
    throw new HageezError('TASK_REQUIRED', 'Provide a task: hageez agent run <name> "task".');
  }

  const reference = overrideFor(name, options.agentModel);
  await assertConnectionsReady(config, [name], { probe: true });
  const result = await runAgent(name, {
    config,
    task,
    projectPath: process.cwd(),
    reference,
  });

  if (result.status === 'success') {
    console.log(result.output);
    console.log('');
    console.log(success(`  ✓ ${result.agent} finished`));
    console.log(theme.dim(`  ${result.connection}/${result.model} · ${result.tokens} tokens · ${(result.durationMs / 1000).toFixed(1)}s`));
    console.log('');
  } else {
    console.log(errorText(`  ✗ ${result.agent} failed: ${result.error ?? 'unknown error'}`));
    process.exitCode = 1;
  }
}

export function listAgents(): void {
  console.log('');
  for (const id of AGENT_IDS) {
    const definition = getAgent(id);
    console.log(`  ${theme.cyan(id.padEnd(16))} ${definition.role}`);
  }
  console.log('');
}
