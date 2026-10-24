import Anthropic from '@anthropic-ai/sdk';
import { HageezConfig, LLMMessage, LLMResponse, HageezError } from '../types';

export async function callAnthropic(
config: HageezConfig,
messages: LLMMessage[]
): Promise<LLMResponse> {
const client = new Anthropic({ apiKey: config.apiKey });
const start = Date.now();
const systemMsg = messages.find(m => m.role === 'system');
const userMsgs = messages.filter(m => m.role !== 'system');
try {
const response = await client.messages.create({
model: config.model,
max_tokens: config.maxTokens,
system: systemMsg?.content,
messages: userMsgs.map(m => ({
role: m.role as 'user' | 'assistant',
content: m.content,
})),
});
const block = response.content[0];
if (!block || block.type !== 'text') {
throw new HageezError('ANTHROPIC_EMPTY_RESPONSE', 'Anthropic returned empty response');
}
return {
content: block.text,
tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
model: response.model,
provider: 'anthropic',
durationMs: Date.now() - start,
};
} catch (err) {
if (err instanceof HageezError) throw err;
throw new HageezError('ANTHROPIC_ERROR', 'Anthropic API call failed', err);
}
}
