import { HageezConfig, ProjectContext } from '../core';
import { callLLM, buildSystemPrompt } from '../core';

export interface DebuggerResult {
content: string;
tokensUsed: number;
fix?: string;
}

export interface HageezDebugger {
diagnose: (error: string, project: ProjectContext) => Promise<DebuggerResult>;
fix: (error: string, code: string, project: ProjectContext) => Promise<DebuggerResult>;
}

export function createDebugger(config: HageezConfig): HageezDebugger {
const sys = buildSystemPrompt(
'You are an expert debugger. Find root causes and provide fixes.',
''
);

return {
async diagnose(error: string, project: ProjectContext): Promise<DebuggerResult> {
const res = await callLLM(config, [
sys,
{
role: 'user',
content: `Diagnose this error in project ${project.name} (${project.language ?? 'unknown'}):\n\n${error}\n\nProvide: Root cause, explanation, and fix steps.`,
},
]);
return { content: res.content, tokensUsed: res.tokensUsed };
},

async fix(error: string, code: string, project: ProjectContext): Promise<DebuggerResult> {
const res = await callLLM(config, [
sys,
{
role: 'user',
content: `Fix this error in project ${project.name}:\n\nError:\n${error}\n\nCode:\n${code.slice(0, 2000)}\n\nProvide the corrected code.`,
},
]);
return { content: res.content, tokensUsed: res.tokensUsed, fix: res.content };
},
};
}
