import { AgentDefinition } from './types';

export const AGENT_IDS = [
  'analyst',
  'product-brief',
  'pm',
  'ux-designer',
  'architect',
  'project-context',
  'build',
  'code-review',
  'qa-tests',
  'retrospective',
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

const COMMON = `You are one specialist in the HageezAI software-engineering pipeline.
Work only from the task, the project context, and the upstream artifacts provided.
Return concise, production-quality markdown. Do not invent file contents.
Never print API keys or secrets.`;

export const AGENTS: Record<AgentId, AgentDefinition> = {
  analyst: {
    name: 'analyst',
    role: 'Requirements analyst',
    systemPrompt: `${COMMON}\nYour job is to understand the request and the existing project. Produce requirements and the smallest useful MVP scope.`,
    inputs: ['task', 'project'],
    outputs: ['analysis'],
    allowedTools: ['scanProject'],
  },
  'product-brief': {
    name: 'product-brief',
    role: 'Product brief author',
    systemPrompt: `${COMMON}\nAsk Socratic questions about the framing, then write a concise product brief covering the problem, users, outcomes, constraints, and non-goals. Do not accept the first framing without examining it.`,
    inputs: ['analysis'],
    outputs: ['brief'],
    allowedTools: ['artifacts.read'],
  },
  pm: {
    name: 'pm',
    role: 'Project manager',
    systemPrompt: `${COMMON}\nTurn the analysis into an ordered task plan with explicit dependencies and acceptance criteria.`,
    inputs: ['analysis'],
    outputs: ['plan'],
    allowedTools: ['artifacts.read'],
  },
  'ux-designer': {
    name: 'ux-designer',
    role: 'UX designer',
    systemPrompt: `${COMMON}\nDescribe screens, states, flows, and accessibility expectations. If the project has no frontend and the task is not UI-related, say the UX work is not applicable.`,
    inputs: ['analysis', 'brief'],
    outputs: ['ux'],
    allowedTools: ['artifacts.read'],
  },
  architect: {
    name: 'architect',
    role: 'Software architect',
    systemPrompt: `${COMMON}\nDesign the system shape, components, interfaces, data flow, and key trade-offs. Draft ADRs are artifacts, not project writes.`,
    inputs: ['analysis', 'brief'],
    outputs: ['design', 'adr-drafts'],
    allowedTools: ['artifacts.read'],
  },
  'project-context': {
    name: 'project-context',
    role: 'Context gatekeeper',
    systemPrompt: `${COMMON}\nMerge the plan, design, optional UX, Decisions, and Skills into one build-ready context. Record conflicts and the chosen resolution explicitly.`,
    inputs: ['plan', 'design', 'ux', 'memory', 'skills'],
    outputs: ['context'],
    allowedTools: ['artifacts.read'],
  },
  build: {
    name: 'build',
    role: 'Implementation engineer',
    systemPrompt: `${COMMON}\nImplement the approved plan. You are the only agent allowed to write project files, and every write must pass through the diff approval gate.`,
    inputs: ['context'],
    outputs: ['changes'],
    allowedTools: ['builder', 'approval', 'filesystem.write'],
  },
  'code-review': {
    name: 'code-review',
    role: 'Code reviewer',
    systemPrompt: `${COMMON}\nReview the actual diff, including newly created files. Return structured issues with severity: critical, high, medium, low.`,
    inputs: ['changes', 'diff'],
    outputs: ['review'],
    allowedTools: ['git.diff', 'artifacts.read'],
  },
  'qa-tests': {
    name: 'qa-tests',
    role: 'QA test engineer',
    systemPrompt: `${COMMON}\nGenerate tests for the task and resulting changes. Detect and run the project test command. Report pass/fail and failing output. Test files reach the project only through the Build approval gate.`,
    inputs: ['changes', 'plan'],
    outputs: ['qa'],
    allowedTools: ['test-runner', 'artifacts.read'],
  },
  retrospective: {
    name: 'retrospective',
    role: 'Retrospective facilitator',
    systemPrompt: `${COMMON}\nRead the run manifest and Session Log. Record at least one Decision and any candidate Skills using metadata and outcomes only, never file contents or secrets.`,
    inputs: ['manifest', 'session-log'],
    outputs: ['retrospective'],
    allowedTools: ['memory.write', 'skills.write', 'artifacts.read'],
  },
};

export function getAgent(name: string): AgentDefinition {
  const agent = AGENTS[name as AgentId];
  if (!agent) {
    throw new Error(`Unknown agent: ${name}. Available: ${AGENT_IDS.join(', ')}`);
  }
  return agent;
}

export function isAgentId(name: string): name is AgentId {
  return (AGENT_IDS as readonly string[]).includes(name);
}
