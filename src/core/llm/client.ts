import { HageezConfig, LLMCallOptions, LLMMessage, LLMResponse, HageezError, ModelReference } from '../types';
import { callOpenAI } from './openai';
import { callAnthropic } from './anthropic';
import { callGrok } from './grok';
import { callGroq } from './groq';
import { callOllama } from './ollama';
import { resolveModelConfig } from './registry';

export async function callLLM(
  config: HageezConfig,
  messages: LLMMessage[],
  options: LLMCallOptions = {},
  reference?: ModelReference
): Promise<LLMResponse> {
  const resolved = resolveModelConfig(config, reference);
  switch (resolved.provider) {
    case 'openai':
    case 'openai-compatible':
      return callOpenAI(resolved, messages, options);
    case 'anthropic':
      return callAnthropic(resolved, messages, options);
    case 'grok':
      return callGrok(resolved, messages, options);
    case 'groq':
      return callGroq(resolved, messages, options);
    case 'ollama':
      return callOllama(resolved, messages, options);
    default:
      throw new HageezError(
        'UNKNOWN_PROVIDER',
        `Unknown LLM provider: ${String(resolved.provider)}`
      );
  }
}

export function buildSystemPrompt(
projectContext: string,
skills: string
): LLMMessage {
return {
role: 'system',
content: `You are HageezAI, an expert AI Software Engineering Assistant.

## Project Context
${projectContext}

## Active Skills
${skills}

## Guidelines
- Write clean, production-quality TypeScript/JavaScript code
- Follow the project's existing conventions and architecture
- Use strict typing, never use 'any'
- Prefer async/await over callbacks
- Always handle errors explicitly
- Explain your decisions briefly before making changes`,
};
}
