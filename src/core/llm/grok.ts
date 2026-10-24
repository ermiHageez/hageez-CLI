import OpenAI from 'openai';
import { HageezConfig, LLMMessage, LLMResponse, HageezError } from '../types';

const GROK_BASE_URL = 'https://api.x.ai/v1';

export async function callGrok(
config: HageezConfig,
messages: LLMMessage[]
): Promise<LLMResponse> {
const client = new OpenAI({
apiKey: config.apiKey,
baseURL: GROK_BASE_URL,
});
const start = Date.now();
try {
const response = await client.chat.completions.create({
model: config.model,
messages: messages.map(m => ({ role: m.role, content: m.content })),
max_tokens: config.maxTokens,
temperature: config.temperature,
});
const choice = response.choices[0];
if (!choice?.message?.content) {
throw new HageezError('GROK_EMPTY_RESPONSE', 'Grok returned empty response');
}
return {
content: choice.message.content,
tokensUsed: response.usage?.total_tokens ?? 0,
model: response.model,
provider: 'grok',
durationMs: Date.now() - start,
};
} catch (err: any) {
if (err instanceof HageezError) throw err;
throw new HageezError('GROK_ERROR', `Grok API call failed: ${err?.message || String(err)}`, err);
}
}
