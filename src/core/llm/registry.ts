import {
  ConnectionConfig,
  ConnectionType,
  HageezConfig,
  HageezError,
  ModelReference,
  ResolvedModelConfig,
} from '../types';

export const LOCAL_TIMEOUT_MS = 300000;
export const CLOUD_TIMEOUT_MS = 60000;

export const CLOUD_CATALOG: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ],
  grok: ['grok-4.3', 'grok-3', 'grok-3-mini'],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ],
  'openai-compatible': [],
  ollama: [],
};

export const DEFAULT_BASE_URLS: Partial<Record<ConnectionType, string>> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  grok: 'https://api.x.ai/v1',
  groq: 'https://api.groq.com/openai/v1',
  ollama: 'http://127.0.0.1:11434',
};

const EMBEDDING_PATTERN = /(embed|embedding|bge[-_]|e5[-_]|nomic|mxbai|all-minilm|snowflake-arctic-embed)/i;

export function isEmbeddingModel(model: string): boolean {
  return EMBEDDING_PATTERN.test(model);
}

export function isLocalConnection(type: ConnectionType): boolean {
  return type === 'ollama';
}

export function connectionsOf(config: HageezConfig): Record<string, ConnectionConfig> {
  return config.connections;
}

export function connectionNames(config: HageezConfig): string[] {
  return Object.keys(connectionsOf(config));
}

export function getConnection(config: HageezConfig, name: string): ConnectionConfig {
  const connection = connectionsOf(config)[name];
  if (!connection) {
    throw new HageezError(
      'CONFIG_INVALID_CONNECTION',
      `Unknown connection: ${name}. Run \`hageez connect list\` to see configured connections.`
    );
  }
  return connection;
}

export function defaultModelReference(config: HageezConfig): ModelReference {
  return config.defaultModel;
}

export function agentModelReference(config: HageezConfig, agent: string): ModelReference {
  const assigned = config.agents?.[agent];
  if (assigned) return assigned;
  return defaultModelReference(config);
}

export function resolveApiKey(config: HageezConfig, connectionName: string): string {
  const connection = getConnection(config, connectionName);
  if (connection.apiKeyEnv) {
    const envValue = process.env[connection.apiKeyEnv];
    if (typeof envValue === 'string' && envValue.trim().length > 0) return envValue.trim();
  }
  if (connection.apiKey && connection.apiKey.length > 0) return connection.apiKey;
  return '';
}

export function resolveBaseUrl(config: HageezConfig, connectionName: string): string | undefined {
  const connection = getConnection(config, connectionName);
  const configured = connection.baseUrl?.trim();
  if (configured) return configured;
  if (connection.type === 'ollama') {
    const envHost = process.env.OLLAMA_HOST?.trim();
    if (envHost) return /^https?:\/\//i.test(envHost) ? envHost : `http://${envHost}`;
  }
  return DEFAULT_BASE_URLS[connection.type];
}

export function connectionTimeout(config: HageezConfig, connectionName: string): number {
  if (config.timeoutMs !== undefined) return config.timeoutMs;
  const connection = getConnection(config, connectionName);
  return isLocalConnection(connection.type) ? LOCAL_TIMEOUT_MS : CLOUD_TIMEOUT_MS;
}

export function connectionConcurrency(config: HageezConfig, connectionName: string): number {
  const connection = getConnection(config, connectionName);
  if (connection.maxConcurrent !== undefined) return connection.maxConcurrent;
  return isLocalConnection(connection.type) ? 1 : 3;
}

export function catalogForConnection(config: HageezConfig, connectionName: string): string[] {
  const connection = getConnection(config, connectionName);
  if (connection.models && connection.models.length > 0) return [...connection.models];
  return [...(CLOUD_CATALOG[connection.type] ?? [])];
}

export function agentUsageCount(config: HageezConfig, connectionName: string): number {
  return Object.values(config.agents ?? {}).filter(
    (assignment) => assignment.connection === connectionName
  ).length;
}

export function resolveModelConfig(
  config: HageezConfig,
  reference: ModelReference = defaultModelReference(config)
): ResolvedModelConfig {
  const connection = getConnection(config, reference.connection);
  return {
    provider: connection.type,
    apiKey: resolveApiKey(config, reference.connection),
    model: reference.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    memoryEnabled: config.memoryEnabled,
    ragEnabled: config.ragEnabled,
    telemetryEnabled: config.telemetryEnabled,
    timeoutMs: connectionTimeout(config, reference.connection),
    baseUrl: resolveBaseUrl(config, reference.connection),
    maxConcurrent: connectionConcurrency(config, reference.connection),
    connectionName: reference.connection,
  };
}

export function resolveAgentConfig(config: HageezConfig, agent: string): ResolvedModelConfig {
  return resolveModelConfig(config, agentModelReference(config, agent));
}
