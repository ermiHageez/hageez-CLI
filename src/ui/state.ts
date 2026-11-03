import { UIEvent, UIEventType } from './events';

export const CANONICAL_AGENTS = [
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

export type CanonicalAgent = typeof CANONICAL_AGENTS[number];

export type AgentStatus = 'waiting' | 'working' | 'done' | 'skipped' | 'failed';

export interface AgentUIState {
  id: string;
  agent: string;
  status: AgentStatus;
  model: string;
  connection: string;
  elapsedSeconds: number;
  formattedTime?: string;
  reason?: string;
  error?: string;
  startTime?: number;
}

export interface FeedBlock {
  id: string;
  kind: 'user' | 'system' | 'agent' | 'diff' | 'test' | 'command';
  title?: string;
  content: string;
  agent?: string;
  timestamp: number;
}

export interface SidebarState {
  title: string;
  runId: string;
  agentsDoneCount: number;
  totalAgents: number;
  tokens: number;
  tokenLimit?: number;
  tokenPercent: number;
  estimatedCost: number;
  agents: AgentUIState[];
}

export interface InputState {
  buffer: string;
  mode: 'build' | 'plan';
  model: string;
}

export interface ApprovalState {
  active: boolean;
  file?: string;
  diff?: string;
  backupPath?: string;
  index?: number;
  total?: number;
}

export interface UIState {
  sidebar: SidebarState;
  feed: {
    blocks: FeedBlock[];
  };
  input: InputState;
  approval: ApprovalState;
}

export function createInitialUIState(overrides?: Partial<UIState>): UIState {
  const initialAgents: AgentUIState[] = CANONICAL_AGENTS.map((name) => ({
    id: name,
    agent: name,
    status: 'waiting',
    model: '',
    connection: '',
    elapsedSeconds: 0,
    formattedTime: undefined,
  }));

  const state: UIState = {
    sidebar: {
      title: 'HageezAI Run',
      runId: 'idle',
      agentsDoneCount: 0,
      totalAgents: initialAgents.length,
      tokens: 0,
      tokenLimit: 128000,
      tokenPercent: 0,
      estimatedCost: 0,
      agents: initialAgents,
    },
    feed: {
      blocks: [],
    },
    input: {
      buffer: '',
      mode: 'build',
      model: 'default',
    },
    approval: {
      active: false,
    },
  };

  if (!overrides) return state;

  return {
    ...state,
    ...overrides,
    sidebar: {
      ...state.sidebar,
      ...overrides.sidebar,
      agents: overrides.sidebar?.agents ?? state.sidebar.agents,
    },
    feed: {
      ...state.feed,
      ...overrides.feed,
    },
    input: {
      ...state.input,
      ...overrides.input,
    },
    approval: {
      ...state.approval,
      ...overrides.approval,
    },
  };
}

export function uiStateReducer(state: UIState, event: UIEvent): UIState {
  switch (event.type) {
    case 'run:start': {
      const payload = event.payload;
      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          runId: payload.runId,
          title: payload.task || state.sidebar.title,
          agentsDoneCount: 0,
          agents: state.sidebar.agents.map((ag) => ({
            ...ag,
            status: 'waiting',
            elapsedSeconds: 0,
            formattedTime: undefined,
            error: undefined,
            reason: undefined,
          })),
        },
        input: {
          ...state.input,
          mode: payload.mode || state.input.mode,
          model: payload.model || state.input.model,
        },
        feed: {
          blocks: [
            ...state.feed.blocks,
            {
              id: `user-${Date.now()}`,
              kind: 'user',
              content: payload.task,
              timestamp: payload.timestamp || Date.now(),
            },
            {
              id: `run-${Date.now()}`,
              kind: 'system',
              content: `Run ${payload.runId} started`,
              timestamp: payload.timestamp || Date.now(),
            },
          ],
        },
      };
    }

    case 'agent:start': {
      const payload = event.payload;
      const now = payload.timestamp || Date.now();
      const updatedAgents = state.sidebar.agents.map((ag) => {
        if (ag.id === payload.id || ag.agent === payload.agent) {
          return {
            ...ag,
            status: 'working' as AgentStatus,
            model: payload.model || ag.model,
            connection: payload.connection || ag.connection,
            startTime: now,
          };
        }
        return ag;
      });

      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          agents: updatedAgents,
        },
      };
    }

    case 'agent:done': {
      const payload = event.payload;
      const durationSec = payload.durationMs !== undefined
        ? Math.round(payload.durationMs / 1000)
        : 0;
      const formatted = `${durationSec}s`;

      const updatedAgents = state.sidebar.agents.map((ag) => {
        if (ag.id === payload.id || ag.agent === payload.agent) {
          return {
            ...ag,
            status: 'done' as AgentStatus,
            elapsedSeconds: durationSec,
            formattedTime: formatted,
          };
        }
        return ag;
      });

      const doneCount = updatedAgents.filter((a) => a.status === 'done').length;

      const newBlocks = [...state.feed.blocks];
      if (payload.summary) {
        newBlocks.push({
          id: `done-${payload.id}-${Date.now()}`,
          kind: 'agent',
          agent: payload.agent,
          content: payload.summary,
          timestamp: payload.timestamp || Date.now(),
        });
      }

      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          agents: updatedAgents,
          agentsDoneCount: doneCount,
        },
        feed: {
          blocks: newBlocks,
        },
      };
    }

    case 'agent:failed': {
      const payload = event.payload;
      const durationSec = payload.durationMs !== undefined
        ? Math.round(payload.durationMs / 1000)
        : 0;

      const updatedAgents = state.sidebar.agents.map((ag) => {
        if (ag.id === payload.id || ag.agent === payload.agent) {
          return {
            ...ag,
            status: 'failed' as AgentStatus,
            error: payload.error,
            elapsedSeconds: durationSec,
            formattedTime: `${durationSec}s`,
          };
        }
        return ag;
      });

      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          agents: updatedAgents,
        },
        feed: {
          blocks: [
            ...state.feed.blocks,
            {
              id: `failed-${payload.id}-${Date.now()}`,
              kind: 'agent',
              agent: payload.agent,
              content: `Failed: ${payload.error}`,
              timestamp: payload.timestamp || Date.now(),
            },
          ],
        },
      };
    }

    case 'agent:skipped': {
      const payload = event.payload;
      const updatedAgents = state.sidebar.agents.map((ag) => {
        if (ag.id === payload.id || ag.agent === payload.agent) {
          return {
            ...ag,
            status: 'skipped' as AgentStatus,
            reason: payload.reason,
          };
        }
        return ag;
      });

      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          agents: updatedAgents,
        },
        feed: {
          blocks: [
            ...state.feed.blocks,
            {
              id: `skipped-${payload.id}-${Date.now()}`,
              kind: 'agent',
              agent: payload.agent,
              content: `Skipped: ${payload.reason || 'dependency failed'}`,
              timestamp: payload.timestamp || Date.now(),
            },
          ],
        },
      };
    }

    case 'usage': {
      const payload = event.payload;
      const limit = payload.contextLimit || state.sidebar.tokenLimit || 128000;
      const total = payload.totalTokens !== undefined ? payload.totalTokens : payload.tokens;
      const percent = Math.min(100, Math.round((total / limit) * 100));

      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          tokens: total,
          tokenLimit: limit,
          tokenPercent: percent,
          estimatedCost: payload.cost !== undefined ? payload.cost : state.sidebar.estimatedCost,
        },
      };
    }

    case 'feed:block': {
      const payload = event.payload;
      return {
        ...state,
        feed: {
          blocks: [
            ...state.feed.blocks,
            {
              id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              kind: payload.kind,
              title: payload.title,
              content: payload.content,
              agent: payload.agent,
              timestamp: payload.timestamp || Date.now(),
            },
          ],
        },
      };
    }

    case 'approval:request': {
      const payload = event.payload;
      return {
        ...state,
        approval: {
          active: true,
          file: payload.file,
          diff: payload.diff,
          backupPath: payload.backupPath,
          index: payload.index,
          total: payload.total,
        },
      };
    }

    default:
      return state;
  }
}
