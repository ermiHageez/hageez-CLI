import { HageezConfig, ProjectContext } from '../core';
import { callLLM, buildSystemPrompt } from '../core';

export interface ReviewerResult {
content: string;
tokensUsed: number;
issues: Array<{ severity: 'error' | 'warn' | 'info'; message: string }>;
}

export interface Reviewer {
review: (code: string, project: ProjectContext) => Promise<ReviewerResult>;
}

export function createReviewer(config: HageezConfig): Reviewer {
const sys = buildSystemPrompt(
'You are an expert code reviewer. Be concise and actionable.',
''
);

return {
async review(code: string, project: ProjectContext): Promise<ReviewerResult> {
const res = await callLLM(config, [
sys,
{
role: 'user',
content: `Review this code for quality, security, and best practices:\n\nProject: ${project.name} (${project.language ?? 'unknown'})\n\n${code.slice(0, 3000)}\n\nList any issues as:\n- [ERROR] description\n- [WARN] description\n- [INFO] description`,
},
]);

const issues: ReviewerResult['issues'] = [];
for (const line of res.content.split('\n')) {
if (line.includes('[ERROR]')) issues.push({ severity: 'error', message: line });
else if (line.includes('[WARN]')) issues.push({ severity: 'warn', message: line });
else if (line.includes('[INFO]')) issues.push({ severity: 'info', message: line });
}

return { content: res.content, tokensUsed: res.tokensUsed, issues };
},
};
}
