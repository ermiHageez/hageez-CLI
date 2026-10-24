import { HageezConfig, ProjectContext, LLMResponse } from '../core';
import { callLLM, buildSystemPrompt } from '../core';

export interface PlannerResult {
content: string;
tokensUsed: number;
}

export interface Planner {
analyzeIntent: (task: string, project: ProjectContext) => Promise<PlannerResult>;
createPlan: (task: string, project: ProjectContext, intent: string) => Promise<PlannerResult>;
}

export function createPlanner(config: HageezConfig): Planner {
const sys = buildSystemPrompt(
'You are an expert AI planner for software engineering tasks.',
''
);

return {
async analyzeIntent(task: string, project: ProjectContext): Promise<PlannerResult> {
const res = await callLLM(config, [
sys,
{
role: 'user',
content: `Analyze the intent of this engineering task in 2-3 sentences:\n\nProject: ${project.name} (${project.language ?? 'unknown'}, ${project.framework ?? 'unknown'})\nTask: "${task}"`,
},
]);
return { content: res.content, tokensUsed: res.tokensUsed };
},

async createPlan(task: string, project: ProjectContext, intent: string): Promise<PlannerResult> {
const res = await callLLM(config, [
sys,
{
role: 'user',
content: `Create a detailed step-by-step execution plan:\n\nProject: ${project.name}\nLanguage: ${project.language ?? 'unknown'}\nFramework: ${project.framework ?? 'unknown'}\nTask: "${task}"\nIntent Analysis: ${intent}\n\nList the exact files to create/modify and what changes to make.`,
},
]);
return { content: res.content, tokensUsed: res.tokensUsed };
},
};
}
