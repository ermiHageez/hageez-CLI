import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ConnectionConfig,
  ConnectionType,
  HageezConfig,
  HageezConfigV2,
  HageezError,
  LLMProvider,
  ModelReference,
} from './types';

const CONFIG_DIR_NAME = '.hageezai';
const CONFIG_FILE_NAME = 'config.json';

export const CONFIG_VERSION = 2;
export const CONFIG_BACKUP_NAME = 'config.v1.json';

const PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'grok', 'groq'];
const CONNECTION_TYPES: ConnectionType[] = [...PROVIDERS, 'ollama', 'openai-compatible'];

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  grok: 'grok-4.3',
  groq: 'llama-3.3-70b-versatile',
};

type CommonSettings = Pick<
  HageezConfigV2,
  'maxTokens' | 'temperature' | 'memoryEnabled' | 'ragEnabled' | 'telemetryEnabled' | 'timeoutMs'
>;

export function getConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

export function getConfigFile(): string {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

function isSupportedProvider(value: string): value is LLMProvider {
  return (PROVIDERS as string[]).includes(value);
}

function isConnectionType(value: string): value is ConnectionType {
  return (CONNECTION_TYPES as string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function securePermissions(target: string, mode: number, kind: string): void {
  try {
    fs.chmodSync(target, mode);
  } catch (err) {
    throw new HageezError(
      'CONFIG_PERMISSION_ERROR',
      `Failed to secure ${kind} permissions.`,
      err
    );
  }
}

export function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } catch (err) {
      throw new HageezError('CONFIG_WRITE_ERROR', 'Failed to create config directory.', err);
    }
  }
  securePermissions(dir, 0o700, 'config directory');
}

export function configExists(): boolean {
  return fs.existsSync(getConfigFile());
}

function commonSettings(raw: Record<string, unknown>): CommonSettings {
  const settings: CommonSettings = {
    maxTokens: typeof raw.maxTokens === 'number' ? raw.maxTokens : 8192,
    temperature: typeof raw.temperature === 'number' ? raw.temperature : 0.2,
    memoryEnabled: typeof raw.memoryEnabled === 'boolean' ? raw.memoryEnabled : true,
    ragEnabled: typeof raw.ragEnabled === 'boolean' ? raw.ragEnabled : true,
    telemetryEnabled:
      typeof raw.telemetryEnabled === 'boolean' ? raw.telemetryEnabled : false,
  };

  if (typeof raw.timeoutMs === 'number') settings.timeoutMs = raw.timeoutMs;
  return settings;
}

function parseConnection(name: string, value: unknown): ConnectionConfig {
  if (!isRecord(value)) {
    throw new HageezError('CONFIG_PARSE_ERROR', `Connection ${name} must be an object.`);
  }

  if (typeof value.type !== 'string' || !isConnectionType(value.type)) {
    throw new HageezError(
      'CONFIG_INVALID_PROVIDER',
      `Unsupported connection type for ${name}: ${String(value.type)}`
    );
  }

  const connection: ConnectionConfig = { type: value.type };

  if (value.apiKey !== undefined) {
    if (typeof value.apiKey !== 'string') {
      throw new HageezError('CONFIG_PARSE_ERROR', `Connection ${name}.apiKey must be a string.`);
    }
    connection.apiKey = value.apiKey;
  }

  if (value.apiKeyEnv !== undefined) {
    if (typeof value.apiKeyEnv !== 'string') {
      throw new HageezError(
        'CONFIG_PARSE_ERROR',
        `Connection ${name}.apiKeyEnv must be a string.`
      );
    }
    connection.apiKeyEnv = value.apiKeyEnv;
  }

  if (value.baseUrl !== undefined) {
    if (typeof value.baseUrl !== 'string') {
      throw new HageezError(
        'CONFIG_PARSE_ERROR',
        `Connection ${name}.baseUrl must be a string.`
      );
    }
    connection.baseUrl = value.baseUrl;
  }

  if (value.maxConcurrent !== undefined) {
    if (
      typeof value.maxConcurrent !== 'number' ||
      !Number.isFinite(value.maxConcurrent) ||
      value.maxConcurrent <= 0
    ) {
      throw new HageezError(
        'CONFIG_PARSE_ERROR',
        `Connection ${name}.maxConcurrent must be a positive number.`
      );
    }
    connection.maxConcurrent = value.maxConcurrent;
  }

  if (value.models !== undefined) {
    if (
      !Array.isArray(value.models) ||
      value.models.some((model) => typeof model !== 'string' || model.trim().length === 0)
    ) {
      throw new HageezError(
        'CONFIG_PARSE_ERROR',
        `Connection ${name}.models must be an array of non-empty strings.`
      );
    }
    connection.models = value.models.map((model) => model.trim());
  }

  return connection;
}

function parseConnections(raw: unknown): Record<string, ConnectionConfig> {
  if (!isRecord(raw)) {
    throw new HageezError('CONFIG_PARSE_ERROR', 'Config connections must be an object.');
  }

  const entries = Object.entries(raw);
  if (entries.length === 0) {
    throw new HageezError('CONFIG_PARSE_ERROR', 'Config must define at least one connection.');
  }

  const connections: Record<string, ConnectionConfig> = {};
  for (const [name, value] of entries) {
    if (name.trim().length === 0) {
      throw new HageezError('CONFIG_PARSE_ERROR', 'Connection names must not be empty.');
    }
    connections[name] = parseConnection(name, value);
  }
  return connections;
}

function parseModelReference(raw: unknown, field: string): ModelReference {
  if (
    !isRecord(raw) ||
    typeof raw.connection !== 'string' ||
    raw.connection.trim().length === 0 ||
    typeof raw.model !== 'string' ||
    raw.model.trim().length === 0
  ) {
    throw new HageezError(
      'CONFIG_PARSE_ERROR',
      `${field} must contain a connection and model.`
    );
  }

  return { connection: raw.connection, model: raw.model };
}

function parseAgents(
  raw: unknown,
  connections: Record<string, ConnectionConfig>
): Record<string, ModelReference> {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    throw new HageezError('CONFIG_PARSE_ERROR', 'Config agents must be an object.');
  }

  const agents: Record<string, ModelReference> = {};
  for (const [name, value] of Object.entries(raw)) {
    const assignment = parseModelReference(value, `agents.${name}`);
    if (!connections[assignment.connection]) {
      throw new HageezError(
        'CONFIG_INVALID_CONNECTION',
        `Agent ${name} references unknown connection: ${assignment.connection}`
      );
    }
    agents[name] = assignment;
  }
  return agents;
}

function parseV2(raw: Record<string, unknown>): HageezConfigV2 {
  const connections = parseConnections(raw.connections);
  const defaultModel = parseModelReference(raw.defaultModel, 'defaultModel');

  if (!connections[defaultModel.connection]) {
    throw new HageezError(
      'CONFIG_INVALID_CONNECTION',
      `Default model references unknown connection: ${defaultModel.connection}`
    );
  }

  return {
    version: CONFIG_VERSION,
    connections,
    defaultModel,
    agents: parseAgents(raw.agents, connections),
    ...commonSettings(raw),
  };
}

function resolveApiKey(connection: ConnectionConfig): string {
  if (connection.apiKeyEnv) {
    const value = process.env[connection.apiKeyEnv];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return connection.apiKey ?? '';
}

function backupV1Config(file: string, dir: string, raw: string): void {
  const backup = path.join(dir, CONFIG_BACKUP_NAME);
  try {
    fs.rmSync(backup, { force: true });
    fs.writeFileSync(backup, raw, { encoding: 'utf-8', mode: 0o600 });
    fs.chmodSync(backup, 0o600);
  } catch (err) {
    throw new HageezError('CONFIG_WRITE_ERROR', 'Failed to back up config file.', err);
  }
}

function migrateV1(
  raw: Record<string, unknown>,
  file: string,
  dir: string,
  contents: string
): HageezConfigV2 {
  if (typeof raw.provider !== 'string' || !isSupportedProvider(raw.provider)) {
    throw new HageezError(
      'CONFIG_INVALID_PROVIDER',
      `Unsupported provider in config: ${String(raw.provider)}`
    );
  }

  const provider = raw.provider;
  const model =
    typeof raw.model === 'string' && raw.model.trim().length > 0
      ? raw.model
      : getDefaultModel(provider);
  const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey : '';

  const config: HageezConfigV2 = {
    version: CONFIG_VERSION,
    connections: {
      [provider]: { type: provider, apiKey },
    },
    defaultModel: { connection: provider, model },
    agents: {},
    ...commonSettings(raw),
  };

  backupV1Config(file, dir, contents);
  saveConfig(config);
  return config;
}

function normalizeConfig(
  raw: Record<string, unknown>,
  file: string,
  dir: string,
  contents: string
): HageezConfig {
  const version = raw.version;
  const looksLikeV2 = version === CONFIG_VERSION || (
    version === undefined &&
    (raw.connections !== undefined || raw.defaultModel !== undefined)
  );

  if (looksLikeV2) {
    return parseV2(raw);
  }

  if (version === undefined || version === 1) {
    return migrateV1(raw, file, dir, contents);
  }

  throw new HageezError(
    'CONFIG_INVALID_VERSION',
    `Unsupported config version: ${String(version)}`
  );
}

export function loadConfig(): HageezConfig {
  const dir = getConfigDir();
  const file = getConfigFile();

  if (!fs.existsSync(file)) {
    throw new HageezError(
      'CONFIG_NOT_FOUND',
      'No HageezAI config found. Run `hageez init` to configure.'
    );
  }

  securePermissions(dir, 0o700, 'config directory');
  securePermissions(file, 0o600, 'config file');

  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf-8');
  } catch (err) {
    throw new HageezError('CONFIG_READ_ERROR', 'Failed to read config file.', err);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new HageezError('CONFIG_PARSE_ERROR', 'Failed to parse config file.', err);
  }

  if (!isRecord(parsed)) {
    throw new HageezError('CONFIG_PARSE_ERROR', 'Config file must contain a JSON object.');
  }

  const envProvider = process.env.HAGEEZ_PROVIDER?.trim();
  if (envProvider && !isSupportedProvider(envProvider)) {
    throw new HageezError(
      'CONFIG_INVALID_PROVIDER',
      `Unsupported HAGEEZ_PROVIDER: ${envProvider}`
    );
  }

  const config = normalizeConfig(parsed, file, dir, raw);

  const envKey = process.env.HAGEEZ_API_KEY?.trim();
  const envModel = process.env.HAGEEZ_MODEL?.trim();
  const envConnection = envProvider && envProvider.length > 0
    ? envProvider
    : config.defaultModel.connection;

  if (envProvider && !config.connections[envProvider]) {
    config.connections[envProvider] = { type: envProvider as LLMProvider };
  }
  const selected = config.connections[envConnection];
  if (!selected) {
    throw new HageezError(
      'CONFIG_INVALID_CONNECTION',
      `Default model references unknown connection: ${envConnection}`
    );
  }
  if (envKey) selected.apiKey = envKey;
  if (envProvider) config.defaultModel.connection = envProvider;
  if (envModel) config.defaultModel.model = envModel;

  const effective = config.connections[config.defaultModel.connection];
  if (!effective || !isConnectionType(effective.type)) {
    throw new HageezError(
      'CONFIG_INVALID_PROVIDER',
      `Unsupported provider in config: ${String(effective?.type)}`
    );
  }

  return config;
}

function serializeConfig(config: HageezConfig): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    version: CONFIG_VERSION,
    connections: config.connections,
    defaultModel: config.defaultModel,
    agents: config.agents ?? {},
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    memoryEnabled: config.memoryEnabled,
    ragEnabled: config.ragEnabled,
    telemetryEnabled: config.telemetryEnabled,
  };
  if (config.timeoutMs !== undefined) serialized.timeoutMs = config.timeoutMs;
  return serialized;
}

export function saveConfig(config: HageezConfig): void {
  ensureConfigDir();
  const file = getConfigFile();

  try {
    fs.writeFileSync(file, JSON.stringify(serializeConfig(config), null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  } catch (err) {
    throw new HageezError('CONFIG_WRITE_ERROR', 'Failed to write config file.', err);
  }

  securePermissions(file, 0o600, 'config file');
}


export function asV2Config(config: HageezConfig): HageezConfigV2 {
  return config;
}

export function getDefaultModel(provider: LLMProvider): string {
  return DEFAULT_MODELS[provider];
}

export function buildDefaultConfig(
  provider: LLMProvider,
  apiKey: string
): HageezConfig {
  return {
    version: CONFIG_VERSION,
    connections: {
      [provider]: { type: provider, apiKey },
    },
    defaultModel: { connection: provider, model: DEFAULT_MODELS[provider] },
    agents: {},
    maxTokens: 8192,
    temperature: 0.2,
    memoryEnabled: true,
    ragEnabled: true,
    telemetryEnabled: false,
    timeoutMs: 60000,
  };
}

export function getSkillsDir(): string {
  return path.join(getConfigDir(), 'skills');
}

export function ensureSkillsDir(): void {
  const dir = getSkillsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
