import { ConnectionType, HageezConfig, HageezError } from '../types';
import {
  getConnection,
  isEmbeddingModel,
  resolveApiKey,
  resolveBaseUrl,
  connectionTimeout,
} from './registry';

export type ModelKind = 'chat' | 'embedding';

export interface ConnectionModel {
  name: string;
  kind: ModelKind;
}

export interface ConnectionProbe {
  ok: boolean;
  models: ConnectionModel[];
  error?: string;
  code?: string;
}

export interface ProbeOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function joinUrl(base: string, suffix: string): string {
  return `${base.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}

function authHeaders(type: ConnectionType, apiKey: string): Record<string, string> {
  if (type === 'anthropic') {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  }
  if (type === 'ollama' || apiKey.length === 0) return {};
  return { Authorization: `Bearer ${apiKey}` };
}

function errorCodeForStatus(status: number): string {
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 404) return 'MODEL_NOT_FOUND';
  if (status === 429) return 'RATE_LIMIT';
  return 'PROVIDER';
}

export function classifyModel(
  name: string,
  details?: { family?: string; families?: string[]; capabilities?: string[] }
): ModelKind {
  const capabilities = details?.capabilities ?? [];
  if (capabilities.includes('embedding')) return 'embedding';
  if (capabilities.includes('completion')) return 'chat';
  const family = [details?.family, ...(details?.families ?? [])].filter(Boolean).join(' ');
  if (isEmbeddingModel(name) || isEmbeddingModel(family)) return 'embedding';
  return 'chat';
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function listConnectionModels(
  config: HageezConfig,
  connectionName: string,
  options: ProbeOptions = {}
): Promise<ConnectionModel[]> {
  const connection = getConnection(config, connectionName);
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = resolveBaseUrl(config, connectionName);
  if (!baseUrl) {
    throw new HageezError(
      'CONNECTION_BASE_URL_REQUIRED',
      `Connection ${connectionName} requires a base URL.`
    );
  }

  const timeoutMs = options.timeoutMs ?? Math.min(connectionTimeout(config, connectionName), 10000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (connection.type === 'ollama') {
      const response = await fetchImpl(joinUrl(baseUrl, '/api/tags'), {
        signal: controller.signal,
        headers: authHeaders(connection.type, ''),
      });
      if (!response.ok) {
        throw new HageezError(
          errorCodeForStatus(response.status),
          `Ollama model listing failed (HTTP ${response.status}).`
        );
      }
      const body = (await readJson(response)) as {
        models?: Array<{ name?: string; model?: string; details?: Record<string, unknown> }>;
      };
      return (body.models ?? [])
        .map((model) => {
          const name = model.name ?? model.model;
          if (!name) return undefined;
          const details = model.details as
            | { family?: string; families?: string[]; capabilities?: string[] }
            | undefined;
          return { name, kind: classifyModel(name, details) };
        })
        .filter((model): model is ConnectionModel => Boolean(model));
    }

    const response = await fetchImpl(joinUrl(baseUrl, '/models'), {
      signal: controller.signal,
      headers: authHeaders(connection.type, resolveApiKey(config, connectionName)),
    });
    if (!response.ok) {
      throw new HageezError(
        errorCodeForStatus(response.status),
        `${connectionName} model listing failed (HTTP ${response.status}).`
      );
    }
    const body = (await readJson(response)) as {
      data?: Array<{ id?: string; name?: string }>;
      models?: Array<{ id?: string; name?: string }>;
    };
    return (body.data ?? body.models ?? [])
      .map((model) => model.id ?? model.name)
      .filter((name): name is string => Boolean(name))
      .map((name) => ({ name, kind: classifyModel(name) }));
  } catch (err) {
    if (err instanceof HageezError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new HageezError('TIMEOUT', `${connectionName} connection timed out.`);
    }
    if (connection.type === 'ollama') {
      throw new HageezError(
        'PROVIDER_UNREACHABLE',
        `Cannot reach Ollama at ${baseUrl}. Start it with \`ollama serve\`.`
      );
    }
    throw new HageezError('PROVIDER', `Cannot reach ${connectionName}.`);
  } finally {
    clearTimeout(timer);
  }
}

export async function probeConnection(
  config: HageezConfig,
  connectionName: string,
  options: ProbeOptions = {}
): Promise<ConnectionProbe> {
  try {
    const models = await listConnectionModels(config, connectionName, options);
    return { ok: true, models };
  } catch (err) {
    const error = err instanceof HageezError ? err : new HageezError('PROVIDER', String(err));
    return { ok: false, models: [], error: error.message, code: error.code };
  }
}
