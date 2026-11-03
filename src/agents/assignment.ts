import chalk from 'chalk';
import {
  catalogForConnection,
  getConnection,
  HageezConfig,
  HageezError,
  isEmbeddingModel,
  ModelReference,
  probeConnection,
  resolveApiKey,
  saveConfig,
} from '../core';
import { AGENT_IDS, AgentId, isAgentId } from './registry';
import { theme, success, warn } from '../ui/theme';

export const LIGHT_AGENTS: AgentId[] = ['analyst', 'product-brief', 'pm', 'retrospective'];
export const HEAVY_AGENTS: AgentId[] = [
  'ux-designer',
  'architect',
  'project-context',
  'build',
  'code-review',
  'qa-tests',
];

export interface AgentTableRow {
  agent: AgentId;
  connection: string;
  model: string;
  status: 'ok' | 'missing-key' | 'embedding' | 'unknown-connection';
}

export function parseAgentModel(value: string): ModelReference {
  const colon = value.indexOf(':');
  const slash = value.indexOf('/');
  const separator = colon !== -1 ? colon : slash;
  if (separator <= 0 || separator === value.length - 1) {
    throw new HageezError(
      'ASSIGNMENT_INVALID',
      `Expected <connection>:<model>, received "${value}".`
    );
  }
  return {
    connection: value.slice(0, separator).trim(),
    model: value.slice(separator + 1).trim(),
  };
}

export function isWeakModel(model: string): boolean {
  return /(?:^|[-_:.])(?:0[.,]5|1|1[.,]5|2|3)b(?:$|[-_:.])/i.test(model);
}

export function resolveAgentReference(
  config: HageezConfig,
  agent: string,
  override?: ModelReference
): ModelReference {
  if (!isAgentId(agent)) {
    throw new HageezError('AGENT_UNKNOWN', `Unknown agent: ${agent}`);
  }
  return override ?? config.agents[agent] ?? config.defaultModel;
}

export function agentTableRows(config: HageezConfig): AgentTableRow[] {
  return AGENT_IDS.map((agent) => {
    const reference = resolveAgentReference(config, agent);
    const connection = config.connections[reference.connection];
    let status: AgentTableRow['status'] = 'ok';
    if (!connection) status = 'unknown-connection';
    else if (isEmbeddingModel(reference.model)) status = 'embedding';
    else if (connection.type !== 'ollama' && !resolveApiKey(config, reference.connection)) {
      status = 'missing-key';
    }
    return { agent, connection: reference.connection, model: reference.model, status };
  });
}

export function printAgentTable(config: HageezConfig): void {
  const rows = agentTableRows(config);
  console.log('');
  console.log(theme.cyan('  Agent-to-model assignments'));
  console.log(theme.dim('  ' + '─'.repeat(68)));
  for (const row of rows) {
    const marker =
      row.status === 'ok' ? success('✓') :
      row.status === 'missing-key' ? warn('!') :
      theme.red('✗');
    console.log(
      `  ${marker} ${row.agent.padEnd(16)} ${row.connection}/${row.model}`
    );
  }
  const connections = [...new Set(rows.map((row) => row.connection))];
  console.log(theme.dim(`  Connections in use: ${connections.join(', ') || 'none'}`));
  console.log('');
}

function validateAssignment(
  config: HageezConfig,
  agent: AgentId,
  reference: ModelReference
): string[] {
  if (!config.connections[reference.connection]) {
    throw new HageezError(
      'CONFIG_INVALID_CONNECTION',
      `Unknown connection: ${reference.connection}`
    );
  }
  if (isEmbeddingModel(reference.model)) {
    throw new HageezError(
      'MODEL_NOT_CHAT',
      `${reference.model} is an embedding model and cannot be assigned to ${agent}.`
    );
  }
  const warnings: string[] = [];
  if (
    ['architect', 'build', 'code-review'].includes(agent) &&
    isWeakModel(reference.model)
  ) {
    warnings.push(
      `${reference.model} is 3B parameters or fewer; ${agent} may produce weak results.`
    );
  }
  const connection = getConnection(config, reference.connection);
  if (connection.type !== 'ollama' && !resolveApiKey(config, reference.connection)) {
    warnings.push(`Connection ${reference.connection} has no API key.`);
  }
  return warnings;
}

export function assignAgent(
  config: HageezConfig,
  agent: string,
  reference: ModelReference
): string[] {
  if (!isAgentId(agent)) throw new HageezError('AGENT_UNKNOWN', `Unknown agent: ${agent}`);
  const warnings = validateAssignment(config, agent, reference);
  config.agents[agent] = reference;
  saveConfig(config);
  return warnings;
}

export function assignAll(config: HageezConfig, reference: ModelReference): string[] {
  const warnings: string[] = [];
  for (const agent of AGENT_IDS) {
    warnings.push(...assignAgent(config, agent, reference));
  }
  return warnings;
}

function firstModel(config: HageezConfig, connectionName: string): string {
  const connection = getConnection(config, connectionName);
  if (connection.models?.[0]) return connection.models[0];
  const catalog = catalogForConnection(config, connectionName);
  if (catalog[0]) return catalog[0];
  if (config.defaultModel.connection === connectionName) return config.defaultModel.model;
  throw new HageezError(
    'MODEL_NOT_FOUND',
    `No model is known for ${connectionName}. Add one with \`hageez models ${connectionName} --add <model>\`.`
  );
}

export function presetReferences(
  config: HageezConfig,
  preset: 'local' | 'cloud' | 'mixed'
): Record<AgentId, ModelReference> {
  const localName = Object.keys(config.connections).find(
    (name) => config.connections[name].type === 'ollama'
  );
  const cloudDefault = config.defaultModel.connection;
  const cloudDefaultConn = config.connections[cloudDefault];
  const cloudName = (cloudDefaultConn && cloudDefaultConn.type !== 'ollama')
    ? cloudDefault
    : Object.keys(config.connections).find((name) => config.connections[name].type !== 'ollama');
  const cloudConnection = cloudName ? config.connections[cloudName] : undefined;

  const localRef = (): ModelReference => {
    if (!localName) {
      throw new HageezError('PRESET_UNAVAILABLE', 'No Ollama connection is configured.');
    }
    return { connection: localName, model: firstModel(config, localName) };
  };
  const cloudRef = (): ModelReference => {
    if (!cloudName || !cloudConnection) {
      throw new HageezError('PRESET_UNAVAILABLE', 'No cloud connection is configured.');
    }
    return { connection: cloudName, model: firstModel(config, cloudName) };
  };

  if (preset === 'local') {
    const ref = localRef();
    return Object.fromEntries(AGENT_IDS.map((agent) => [agent, ref])) as Record<AgentId, ModelReference>;
  }
  if (preset === 'cloud') {
    const ref = cloudRef();
    return Object.fromEntries(AGENT_IDS.map((agent) => [agent, ref])) as Record<AgentId, ModelReference>;
  }

  const local = localRef();
  const cloud = cloudRef();
  return Object.fromEntries(
    AGENT_IDS.map((agent) => [agent, LIGHT_AGENTS.includes(agent) ? local : cloud])
  ) as Record<AgentId, ModelReference>;
}

export function applyPreset(
  config: HageezConfig,
  preset: 'local' | 'cloud' | 'mixed'
): string[] {
  const references = presetReferences(config, preset);
  const warnings: string[] = [];
  for (const agent of AGENT_IDS) {
    warnings.push(...assignAgent(config, agent, references[agent]));
  }
  return warnings;
}

export function resetAssignments(config: HageezConfig): void {
  config.agents = {};
  saveConfig(config);
}

export function formatAssignmentWarnings(warnings: string[]): string {
  return warnings.map((warning) => chalk.yellow(`  Warning: ${warning}`)).join('\n');
}

export async function assertConnectionsReady(
  config: HageezConfig,
  agents: string[],
  options: { probe?: boolean; fetchImpl?: typeof fetch } = {}
): Promise<void> {
  const names = [...new Set(agents.map((agent) => resolveAgentReference(config, agent).connection))];
  for (const name of names) {
    const connection = getConnection(config, name);
    if (connection.type !== 'ollama' && !resolveApiKey(config, name)) {
      throw new HageezError(
        'AGENT_MODEL_UNAVAILABLE',
        `Connection ${name} has no API key. Configure it before running an agent.`
      );
    }
    if (options.probe) {
      const probe = await probeConnection(config, name, { fetchImpl: options.fetchImpl });
      if (!probe.ok) {
        throw new HageezError(
          'AGENT_MODEL_UNAVAILABLE',
          `Connection ${name} is unreachable: ${probe.error ?? 'unknown error'}`
        );
      }
    }
  }
}
