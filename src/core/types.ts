export type LLMProvider = 'openai' | 'anthropic' | 'grok' | 'groq';

export interface HageezConfig {
provider: LLMProvider;
apiKey: string;
model: string;
maxTokens: number;
temperature: number;
memoryEnabled: boolean;
ragEnabled: boolean;
telemetryEnabled: boolean;
}

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

export interface LLMResponse {
content: string;
tokensUsed: number;
model: string;
provider: LLMProvider;
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
outcome: 'success' | 'error' | 'partial';
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
