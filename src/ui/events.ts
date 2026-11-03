import { EventEmitter } from 'events';

export type UIEventType =
  | 'run:start'
  | 'agent:start'
  | 'agent:done'
  | 'agent:failed'
  | 'agent:skipped'
  | 'usage'
  | 'feed:block'
  | 'approval:request';

export interface RunStartPayload {
  runId: string;
  task: string;
  mode?: 'build' | 'plan';
  model?: string;
  timestamp?: number;
}

export interface AgentStartPayload {
  id: string;
  agent: string;
  model?: string;
  connection?: string;
  timestamp?: number;
}

export interface AgentDonePayload {
  id: string;
  agent: string;
  durationMs?: number;
  summary?: string;
  timestamp?: number;
}

export interface AgentFailedPayload {
  id: string;
  agent: string;
  error: string;
  durationMs?: number;
  timestamp?: number;
}

export interface AgentSkippedPayload {
  id: string;
  agent: string;
  reason?: string;
  timestamp?: number;
}

export interface UsagePayload {
  tokens: number;
  totalTokens?: number;
  contextLimit?: number;
  cost?: number;
}

export interface FeedBlockPayload {
  kind: 'user' | 'system' | 'agent' | 'diff' | 'test' | 'command';
  title?: string;
  content: string;
  agent?: string;
  timestamp?: number;
}

export interface ApprovalRequestPayload {
  file: string;
  diff: string;
  backupPath?: string;
  index?: number;
  total?: number;
}

export type UIEventMap = {
  'run:start': RunStartPayload;
  'agent:start': AgentStartPayload;
  'agent:done': AgentDonePayload;
  'agent:failed': AgentFailedPayload;
  'agent:skipped': AgentSkippedPayload;
  'usage': UsagePayload;
  'feed:block': FeedBlockPayload;
  'approval:request': ApprovalRequestPayload;
};

export type UIEvent = {
  [K in UIEventType]: { type: K; payload: UIEventMap[K] };
}[UIEventType];

class UIEventBus extends EventEmitter {
  emitEvent<K extends UIEventType>(type: K, payload: UIEventMap[K]): boolean {
    return this.emit(type, payload);
  }
}

export const uiEventBus = new UIEventBus();

export function emitUIEvent<K extends UIEventType>(type: K, payload: UIEventMap[K]): void {
  uiEventBus.emitEvent(type, payload);
}
