import {
  asV2Config,
  catalogForConnection,
  HageezConfig,
  HageezError,
  isEmbeddingModel,
  loadConfig,
  saveConfig,
} from '../core';
import { theme, success, warn } from '../ui/theme';

function loadV2() {
  try {
    return asV2Config(loadConfig());
  } catch (err) {
    if (err instanceof HageezError && err.code === 'CONFIG_NOT_FOUND') {
      throw new HageezError('CONFIG_NOT_FOUND', 'Run `hageez init` first.');
    }
    throw err;
  }
}

function connectionOrThrow(config: ReturnType<typeof loadV2>, name: string) {
  if (!config.connections[name]) {
    throw new HageezError('CONFIG_INVALID_CONNECTION', `Unknown connection: ${name}`);
  }
  return config.connections[name];
}

export function runModelsList(connectionName?: string): void {
  const config = loadV2();
  const names = connectionName ? [connectionName] : Object.keys(config.connections);
  console.log('');
  for (const name of names) {
    const connection = connectionOrThrow(config, name);
    const models = catalogForConnection(config as unknown as HageezConfig, name);
    const isDefaultConnection = config.defaultModel.connection === name;
    console.log(theme.cyan(`  ${name}`) + theme.dim(` (${connection.type})`));
    if (models.length === 0) {
      console.log(theme.dim('    No catalog entries. Add one with `hageez models ' + name + ' --add <model>`.'));
    }
    for (const model of models) {
      const selected = isDefaultConnection && config.defaultModel.model === model;
      const kind = isEmbeddingModel(model) ? warn(' embedding') : '';
      console.log(`    ${selected ? success('*') : ' '} ${model}${kind}`);
    }
  }
  console.log('');
}

export function runModelsAdd(connectionName: string, model: string): void {
  const config = loadV2();
  const connection = connectionOrThrow(config, connectionName);
  if (isEmbeddingModel(model)) {
    throw new HageezError(
      'MODEL_NOT_CHAT',
      `${model} is an embedding model and cannot be used for chat.`
    );
  }
  const models = new Set(connection.models ?? catalogForConnection(config as unknown as HageezConfig, connectionName));
  models.add(model);
  connection.models = [...models];
  saveConfig(config);
  console.log(success(`  ✓ Added ${model} to ${connectionName}`));
}

export function runModelsReset(connectionName: string): void {
  const config = loadV2();
  const connection = connectionOrThrow(config, connectionName);
  delete connection.models;
  saveConfig(config);
  console.log(success(`  ✓ Reset ${connectionName} to its built-in catalog`));
}

export function runModels(connectionName: string | undefined, options: { add?: string; reset?: boolean }): void {
  if (options.add && options.reset) {
    throw new HageezError('CONFIG_PARSE_ERROR', 'Use either --add or --reset, not both.');
  }
  if (options.add) {
    if (!connectionName) throw new HageezError('CONFIG_PARSE_ERROR', '--add requires a connection name.');
    runModelsAdd(connectionName, options.add);
    return;
  }
  if (options.reset) {
    if (!connectionName) throw new HageezError('CONFIG_PARSE_ERROR', '--reset requires a connection name.');
    runModelsReset(connectionName);
    return;
  }
  runModelsList(connectionName);
}

