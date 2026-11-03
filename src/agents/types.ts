import { ModelReference } from '../core';

export interface AgentDefinition {
  name: string;
  role: string;
  systemPrompt: string;
  inputs: string[];
  outputs: string[];
  allowedTools: string[];
  connection?: string;
  model?: string;
}

export interface AgentRunResult {
  agent: string;
  status: 'success' | 'failed' | 'skipped';
  output: string;
  artifacts: string[];
  tokens: number;
  error?: string;
  model: string;
  connection: string;
  durationMs: number;
}

export interface AgentModelOverride {
  agent: string;
  reference: ModelReference;
}
