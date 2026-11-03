export type LLMProvider = 'openai' | 'anthropic' | 'grok' | 'groq';
export type ConnectionType = LLMProvider | 'ollama' | 'openai-compatible';

export interface ConnectionConfig {
type: ConnectionType;
apiKey?: string;
apiKeyEnv?: string;
baseUrl?: string;
maxConcurrent?: number;
models?: string[];
}

export interface ModelReference {
connection: string;
model: string;
}

export interface HageezConfigV2 {
version: 2;
connections: Record<string, ConnectionConfig>;
defaultModel: ModelReference;
agents: Record<string, ModelReference>;
maxTokens: number;
temperature: number;
memoryEnabled: boolean;
ragEnabled: boolean;
telemetryEnabled: boolean;
timeoutMs?: number;
}

export interface ResolvedModelConfig {
  provider: ConnectionType;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  memoryEnabled: boolean;
  ragEnabled: boolean;
  telemetryEnabled: boolean;
  timeoutMs?: number;
  baseUrl?: string;
  maxConcurrent?: number;
  connectionName: string;
}

export type HageezConfig = HageezConfigV2;

export interface ProjectContext {
path: string;
name: string;
language: string | null;
framework: string | null;
database: string | null;
buildTool: string | null;
architecture: string | null;
branch: string | null;
filesScanned: number;
linesOfCode: number;
dependencies: number;
}

export interface ExecutionStep {
id: number;
label: string;
status: 'pending' | 'running' | 'done' | 'error';
output?: string;
durationMs?: number;
}

export interface ExecutionPlan {
task: string;
steps: ExecutionStep[];
estimatedTokens: number;
}

export interface LLMMessage {
role: 'system' | 'user' | 'assistant';
content: string;
}

export interface LLMCallOptions {
signal?: AbortSignal;
}

export interface LLMResponse {
content: string;
tokensUsed: number;
model: string;
  provider: ConnectionType;
  durationMs: number;
}

export interface MemoryEntry {
id: string;
projectPath: string;
type: 'decision' | 'convention' | 'preference' | 'session';
key: string;
value: string;
createdAt: string;
updatedAt: string;
}

export interface SessionLog {
id: string;
timestamp: string;
command: string;
task: string;
steps: ExecutionStep[];
tokensUsed: number;
durationMs: number;
outcome: 'success' | 'error' | 'partial' | 'failed';
error?: string;
projectPath: string;
}

export interface Skill {
name: string;
description: string;
source: string;
command: string;
content: string;
}

export interface SkillRegistry {
skills: Skill[];
installedSources: string[];
}

export class HageezError extends Error {
constructor(
public readonly code: string,
message: string,
public readonly cause?: unknown
) {
super(message);
this.name = 'HageezError';
}
}
