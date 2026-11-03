import inquirer from 'inquirer';
import {
  HageezConfig,
  HageezError,
  loadConfig,
  probeConnection,
} from '../core';
import {
  AGENT_IDS,
  AgentId,
  getAgent,
  isAgentId,
} from '../agents/registry';
import {
  applyPreset,
  assignAgent,
  assignAll,
  formatAssignmentWarnings,
  parseAgentModel,
  printAgentTable,
  resetAssignments,
} from '../agents/assignment';
import { theme, success } from '../ui/theme';

export interface AssignOptions {
  all?: string;
  preset?: string;
  show?: boolean;
  reset?: boolean;
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

async function warnUnreachable(config: HageezConfig, connectionName: string): Promise<void> {
  const probe = await probeConnection(config, connectionName, { timeoutMs: 3000 });
  if (!probe.ok) {
    console.log(theme.yellow(`  Warning: ${connectionName} is unreachable — ${probe.error ?? 'unknown error'}`));
  }
}

export async function runAssign(
  agent: string | undefined,
  assignment: string | undefined,
  options: AssignOptions = {}
): Promise<void> {
  const config = load();
  if (agent === 'show' && !assignment) options = { ...options, show: true };
  if (agent === 'reset' && !assignment) options = { ...options, reset: true };
  if (agent === 'all' && assignment) {
    options = { ...options, all: assignment };
    agent = undefined;
    assignment = undefined;
  }
  if (agent === 'preset' && assignment) {
    options = { ...options, preset: assignment };
    agent = undefined;
    assignment = undefined;
  }

  if (options.show || (!agent && !assignment && !options.all && !options.preset && !options.reset)) {
    if (!options.show && !agent && !assignment && !options.all && !options.preset && !options.reset && process.stdin.isTTY === true) {
      await interactiveAssign(config);
      return;
    }
    printAgentTable(config);
    return;
  }

  if (options.reset) {
    resetAssignments(config);
    console.log(success('  ✓ Agent assignments reset to the default model'));
    return;
  }

  if (options.preset) {
    if (!['local', 'cloud', 'mixed'].includes(options.preset)) {
      throw new HageezError('PRESET_UNAVAILABLE', 'Preset must be local, cloud, or mixed.');
    }
    const warnings = applyPreset(config, options.preset as 'local' | 'cloud' | 'mixed');
    if (warnings.length > 0) console.log(formatAssignmentWarnings(warnings));
    console.log(success(`  ✓ Applied ${options.preset} preset`));
    await warnUnreachable(config, config.defaultModel.connection);
    return;
  }

  if (options.all) {
    const reference = parseAgentModel(options.all);
    const warnings = assignAll(config, reference);
    if (warnings.length > 0) console.log(formatAssignmentWarnings(warnings));
    console.log(success(`  ✓ Assigned all agents to ${reference.connection}/${reference.model}`));
    await warnUnreachable(config, reference.connection);
    return;
  }

  if (!agent || !assignment) {
    throw new HageezError(
      'ASSIGNMENT_INVALID',
      'Usage: hageez assign <agent> <connection>:<model>, --all, --preset, show, or reset.'
    );
  }
  if (!isAgentId(agent)) {
    throw new HageezError('AGENT_UNKNOWN', `Unknown agent: ${agent}`);
  }
  const reference = parseAgentModel(assignment);
  const warnings = assignAgent(config, agent, reference);
  if (warnings.length > 0) console.log(formatAssignmentWarnings(warnings));
  console.log(success(`  ✓ ${agent} → ${reference.connection}/${reference.model}`));
  await warnUnreachable(config, reference.connection);
}

async function interactiveAssign(config: HageezConfig): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'agent',
      message: 'Assign which agent?',
      choices: AGENT_IDS.map((id) => ({ name: `${id} — ${getAgent(id).role}`, value: id })),
    },
    {
      type: 'list',
      name: 'connection',
      message: 'Connection:',
      choices: Object.keys(config.connections),
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model:',
      default: (answers: { connection?: string }) =>
        config.connections[answers.connection ?? '']?.models?.[0] ?? config.defaultModel.model,
    },
  ] as any) as { agent: AgentId; connection: string; model: string };

  const warnings = assignAgent(config, answers.agent, {
    connection: answers.connection,
    model: answers.model,
  });
  if (warnings.length > 0) console.log(formatAssignmentWarnings(warnings));
  console.log(success(`  ✓ ${answers.agent} → ${answers.connection}/${answers.model}`));
}
