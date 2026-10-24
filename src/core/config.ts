import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HageezConfig, HageezError, LLMProvider } from './types';

const CONFIG_DIR = path.join(os.homedir(), '.hageezai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  grok: 'grok-4.3',
  groq: 'llama-3.3-70b-versatile',
};

export function ensureConfigDir(): void {
if (!fs.existsSync(CONFIG_DIR)) {
fs.mkdirSync(CONFIG_DIR, { recursive: true });
}
}

export function configExists(): boolean {
return fs.existsSync(CONFIG_FILE);
}

export function loadConfig(): HageezConfig {
if (!configExists()) {
throw new HageezError(
'CONFIG_NOT_FOUND',
'No HageezAI config found. Run `hageez init` to configure.'
);
}
try {
const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
return JSON.parse(raw) as HageezConfig;
} catch (err) {
throw new HageezError('CONFIG_PARSE_ERROR', 'Failed to parse config file.', err);
}
}

export function saveConfig(config: HageezConfig): void {
ensureConfigDir();
fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function getDefaultModel(provider: LLMProvider): string {
return DEFAULT_MODELS[provider];
}

export function getConfigDir(): string {
return CONFIG_DIR;
}

export function buildDefaultConfig(
provider: LLMProvider,
apiKey: string
): HageezConfig {
return {
provider,
apiKey,
model: DEFAULT_MODELS[provider],
maxTokens: 8192,
temperature: 0.2,
memoryEnabled: true,
ragEnabled: true,
telemetryEnabled: false,
};
}

export function getSkillsDir(): string {
return path.join(CONFIG_DIR, 'skills');
}

export function ensureSkillsDir(): void {
const dir = getSkillsDir();
if (!fs.existsSync(dir)) {
fs.mkdirSync(dir, { recursive: true });
}
}
