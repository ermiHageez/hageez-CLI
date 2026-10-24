import { HageezConfig, LLMMessage, LLMResponse, HageezError } from '../types';
import { callOpenAI } from './openai';
import { callAnthropic } from './anthropic';
import { callGrok } from './grok';
import { callGroq } from './groq';

export async function callLLM(
  config: HageezConfig,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  switch (config.provider) {
    case 'openai':
      return callOpenAI(config, messages);
    case 'anthropic':
      return callAnthropic(config, messages);
    case 'grok':
      return callGrok(config, messages);
    case 'groq':
      return callGroq(config, messages);
    default:
      throw new HageezError(
        'UNKNOWN_PROVIDER',
        `Unknown LLM provider: ${String(config.provider)}`
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
