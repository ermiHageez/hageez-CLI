import chalk from 'chalk';
import {
  asV2Config,
  catalogForConnection,
  ConnectionType,
  getConnection,
  HageezConfig,
  HageezError,
  loadConfig,
  probeConnection,
  resolveApiKey,
  saveConfig,
} from '../core';
import { theme, success, warn, error as errorText } from '../ui/theme';

export interface ConnectAddOptions {
  key?: string;
  keyEnv?: string;
  baseUrl?: string;
  model?: string;
  maxConcurrent?: string;
}

const CONNECTION_TYPES: ConnectionType[] = [
  'openai',
  'anthropic',
  'grok',
  'groq',
  'openai-compatible',
  'ollama',
];

function requireConfig(): HageezConfig {
  try {
    return loadConfig();
  } catch (err) {
    if (err instanceof HageezError && err.code === 'CONFIG_NOT_FOUND') {
      throw new HageezError('CONFIG_NOT_FOUND', 'Run `hageez init` before adding connections.');
    }
    throw err;
  }
}

function parseConcurrency(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new HageezError('CONFIG_PARSE_ERROR', '--max-concurrent must be a positive integer.');
  }
  return value;
}

export function runConnectAdd(
  name: string,
  type: string,
  options: ConnectAddOptions = {}
): HageezConfig {
  if (!CONNECTION_TYPES.includes(type as ConnectionType)) {
    throw new HageezError(
      'CONFIG_INVALID_PROVIDER',
      `Unsupported connection type: ${type}. Use one of ${CONNECTION_TYPES.join(', ')}.`
    );
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new HageezError('CONFIG_PARSE_ERROR', 'Connection name may contain letters, numbers, dot, dash, or underscore.');
  }

  const config = asV2Config(requireConfig());
  const connectionType = type as ConnectionType;
  const maxConcurrent = parseConcurrency(options.maxConcurrent);

  if (connectionType !== 'ollama' && !options.key && !options.keyEnv) {
    throw new HageezError(
      'AUTH',
      `Connection ${name} needs --key or --key-env. Use \`hageez connect add ${name} ${type} --key-env ${type.toUpperCase()}_API_KEY\`.`
    );
  }
  if (connectionType === 'openai-compatible' && !options.baseUrl) {
    throw new HageezError('CONFIG_PARSE_ERROR', 'openai-compatible connections require --base-url.');
  }

  const existing = config.connections[name];
  const models = new Set(existing?.models ?? []);
  if (options.model) models.add(options.model);

  config.connections[name] = {
    type: connectionType,
    ...(options.key ? { apiKey: options.key } : {}),
    ...(options.keyEnv ? { apiKeyEnv: options.keyEnv } : {}),
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(maxConcurrent !== undefined ? { maxConcurrent } : {}),
    ...(models.size > 0 ? { models: [...models] } : {}),
  };

  if (!config.defaultModel) {
    const model = options.model ?? catalogForConnection(config as unknown as HageezConfig, name)[0] ?? '';
    if (model) config.defaultModel = { connection: name, model };
  }

  saveConfig(config);
  return config as unknown as HageezConfig;
}

export function runConnectList(): void {
  const config = asV2Config(requireConfig());
  const names = Object.keys(config.connections);
  console.log('');
  console.log(theme.cyan('  Connections'));
  console.log(theme.dim('  ' + '─'.repeat(60)));
  for (const name of names) {
    const connection = config.connections[name];
    const isDefault = config.defaultModel.connection === name;
    const agents = Object.values(config.agents).filter((item) => item.connection === name).length;
    const marker = isDefault ? success(' (default)') : '';
    const key = connection.type === 'ollama'
      ? theme.dim('local')
      : resolveApiKey(config as unknown as HageezConfig, name)
        ? theme.green('key set')
        : warn('missing key');
    console.log(
      `  ${theme.white(name)}${marker}  ${theme.cyan(connection.type)}  ${key}` +
      (agents > 0 ? theme.dim(`  ${agents} agent(s)`) : '')
    );
    if (connection.baseUrl) console.log(theme.dim(`    ${connection.baseUrl}`));
    if (isDefault) console.log(theme.dim(`    model: ${config.defaultModel.model}`));
  }
  console.log('');
}

export async function runConnectTest(name?: string): Promise<boolean> {
  const config = asV2Config(requireConfig());
  const names = name ? [name] : Object.keys(config.connections);
  let allOk = true;
  console.log('');
  for (const connectionName of names) {
    getConnection(config as unknown as HageezConfig, connectionName);
    const probe = await probeConnection(config as unknown as HageezConfig, connectionName, {
      timeoutMs: 5000,
    });
    if (probe.ok) {
      console.log(
        success(`  ✓ ${connectionName}`) +
        theme.dim(` — ${probe.models.length} model(s) available`)
      );
    } else {
      allOk = false;
      console.log(errorText(`  ✗ ${connectionName}`) + theme.dim(` — ${probe.error ?? 'unreachable'}`));
    }
  }
  console.log('');
  return allOk;
}

export function runConnectUse(name: string, model?: string): void {
  const config = asV2Config(requireConfig());
  const connection = config.connections[name];
  if (!connection) {
    throw new HageezError('CONFIG_INVALID_CONNECTION', `Unknown connection: ${name}`);
  }

  const available = catalogForConnection(config as unknown as HageezConfig, name);
  const selected = model ?? (config.defaultModel.connection === name
    ? config.defaultModel.model
    : available[0]);
  if (!selected) {
    throw new HageezError(
      'MODEL_NOT_FOUND',
      `No model selected. Pass a model, e.g. \`hageez connect use ${name} <model>\`.`
    );
  }

  if (selected) {
    if (!connection.models) {
      connection.models = [selected];
    } else if (!connection.models.includes(selected)) {
      connection.models.push(selected);
    }
  }

  config.defaultModel = { connection: name, model: selected };
  saveConfig(config);
  console.log(success(`  ✓ Default model: ${name}/${selected}`));
}

export function runConnectRemove(name: string): void {
  const config = asV2Config(requireConfig());
  if (!config.connections[name]) {
    throw new HageezError('CONFIG_INVALID_CONNECTION', `Unknown connection: ${name}`);
  }
  if (config.defaultModel.connection === name) {
    throw new HageezError(
      'CONNECTION_IN_USE',
      `Cannot remove ${name}: it is the default connection. Use \`hageez connect use\` to select another first.`
    );
  }
  const assigned = Object.entries(config.agents).filter(([, ref]) => ref.connection === name);
  if (assigned.length > 0) {
    throw new HageezError(
      'CONNECTION_IN_USE',
      `Cannot remove ${name}: assigned to ${assigned.map(([agent]) => agent).join(', ')}.`
    );
  }
  delete config.connections[name];
  if (Object.keys(config.connections).length === 0) {
    throw new HageezError('CONNECTION_IN_USE', 'Cannot remove the last connection.');
  }
  saveConfig(config);
  console.log(success(`  ✓ Removed connection ${name}`));
}

export function runConnectShow(name?: string): void {
  const config = asV2Config(requireConfig());
  const names = name ? [name] : Object.keys(config.connections);
  for (const connectionName of names) {
    const connection = config.connections[connectionName];
    if (!connection) throw new HageezError('CONFIG_INVALID_CONNECTION', `Unknown connection: ${connectionName}`);
    console.log('');
    console.log(chalk.bold(theme.white(`  ${connectionName}`)));
    console.log(`  ${theme.dim('type')}       ${connection.type}`);
    if (connection.baseUrl) console.log(`  ${theme.dim('base URL')}   ${connection.baseUrl}`);
    if (connection.apiKeyEnv) console.log(`  ${theme.dim('key env')}    ${connection.apiKeyEnv}`);
    console.log(`  ${theme.dim('key')}        ${connection.type === 'ollama' ? 'not required' : resolveApiKey(config as unknown as HageezConfig, connectionName) ? 'set' : 'missing'}`);
    console.log(`  ${theme.dim('concurrency')} ${connection.maxConcurrent ?? (connection.type === 'ollama' ? 1 : 3)}`);
    console.log(`  ${theme.dim('models')}     ${catalogForConnection(config as unknown as HageezConfig, connectionName).join(', ') || '(none)'}`);
  }
  console.log('');
}
