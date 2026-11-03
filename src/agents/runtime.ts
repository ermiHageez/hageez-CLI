import * as path from 'path';
import {
  callLLM,
  HageezConfig,
  HageezError,
  LLMCallOptions,
  LLMMessage,
  LLMResponse,
  ModelReference,
  resolveModelConfig,
} from '../core';
import { buildMemoryContext } from '../memory';
import { buildSkillsContext } from '../skills';
import { resolveAgentReference } from './assignment';
import { getAgent } from './registry';
import { AgentRunResult } from './types';

export type AgentModelCall = (
  config: HageezConfig,
  messages: LLMMessage[],
  options?: LLMCallOptions,
  reference?: ModelReference
) => Promise<LLMResponse>;

export interface AgentRunOptions {
  config: HageezConfig;
  task: string;
  projectPath?: string;
  inputs?: Record<string, string>;
  reference?: ModelReference;
  call?: AgentModelCall;
  dryRun?: boolean;
}

function buildAgentPrompt(
  agentName: string,
  task: string,
  projectPath: string,
  inputs: Record<string, string>
): string {
  const definition = getAgent(agentName);
  const sections = [definition.systemPrompt, '', `## Project\n${projectPath}`];
  const memory = buildMemoryContext(projectPath);
  if (memory) sections.push('', '## Recalled Decisions', memory);
  const skills = buildSkillsContext(projectPath, agentName);
  if (skills) sections.push('', '## Applicable Skills', skills);
  const upstream = Object.entries(inputs).filter(([, value]) => value.trim().length > 0);
  if (upstream.length > 0) {
    sections.push('', '## Upstream Artifacts');
    for (const [name, value] of upstream) {
      sections.push('', `### ${name}`, value);
    }
  }
  sections.push('', '## Task', task);
  return sections.join('\n');
}

export async function runAgent(agentName: string, options: AgentRunOptions): Promise<AgentRunResult> {
  const start = Date.now();
  let reference: ModelReference | undefined;
  try {
    reference = resolveAgentReference(options.config, agentName, options.reference);
    const definition = getAgent(agentName);
    const resolved = resolveModelConfig(options.config, reference);
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: buildAgentPrompt(
          agentName,
          options.task,
          options.projectPath ?? process.cwd(),
          options.inputs ?? {}
        ),
      },
      { role: 'user', content: options.task },
    ];
    const call = options.call ?? callLLM;
    const response = await call(options.config, messages, {}, reference);
    return {
      agent: definition.name,
      status: 'success',
      output: response.content,
      artifacts: [...definition.outputs],
      tokens: response.tokensUsed,
      model: response.model || resolved.model,
      connection: reference.connection,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const error = err instanceof HageezError ? err : new HageezError('AGENT_FAILED', String(err));
    return {
      agent: agentName,
      status: 'failed',
      output: '',
      artifacts: [],
      tokens: 0,
      error: error.message,
      model: reference?.model ?? '',
      connection: reference?.connection ?? '',
      durationMs: Date.now() - start,
    };
  }
}

export function buildAgentSystemPrompt(
  agentName: string,
  task: string,
  projectPath = process.cwd(),
  inputs: Record<string, string> = {}
): string {
  return buildAgentPrompt(agentName, task, path.resolve(projectPath), inputs);
}
