import {
  HageezConfig,
  ModelReference,
  connectionConcurrency,
  getConnection,
} from '../core';
import {
  createRun,
  finishRun,
  readArtifact,
  RunManifest,
  writeArtifact,
} from '../artifacts';
import { resolveAgentReference } from '../agents/assignment';
import { runAgent, AgentModelCall } from '../agents/runtime';
import { AgentRunResult } from '../agents/types';
import { getAgent } from '../agents/registry';
import { emitUIEvent } from '../ui/events';

export interface PipelineNode {
  id: string;
  agent: string;
  dependsOn: string[];
  optional?: boolean;
}

export interface PipelineDefinition {
  name: string;
  nodes: PipelineNode[];
}

export type PipelineNodeStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface PipelineNodeState {
  node: PipelineNode;
  status: PipelineNodeStatus;
  result?: AgentRunResult;
  error?: string;
}

export interface PipelineProgress {
  type: 'start' | 'success' | 'failed' | 'skipped';
  id: string;
  agent: string;
  message?: string;
}

export interface PipelineOptions {
  config: HageezConfig;
  task: string;
  projectPath?: string;
  runId?: string;
  concurrency?: number;
  dryRun?: boolean;
  call?: AgentModelCall;
  execute?: (
    node: PipelineNode,
    context: { inputs: Record<string, string>; canWriteProject: boolean; task: string; runId: string }
  ) => Promise<AgentRunResult>;
  onProgress?: (progress: PipelineProgress) => void;
}

export interface PipelineResult {
  runId: string;
  manifest?: RunManifest;
  nodes: PipelineNodeState[];
}

export function validatePipeline(definition: PipelineDefinition): void {
  if (!definition.name.trim()) {
    throw new Error('Pipeline name must not be empty.');
  }
  const ids = new Set<string>();
  for (const node of definition.nodes) {
    if (ids.has(node.id)) throw new Error(`Duplicate pipeline node: ${node.id}`);
    if (!node.id.trim()) throw new Error('Pipeline node id must not be empty.');
    ids.add(node.id);
    getAgent(node.agent);
  }
  for (const node of definition.nodes) {
    for (const dependency of node.dependsOn) {
      if (!ids.has(dependency)) {
        throw new Error(`Node ${node.id} depends on unknown node: ${dependency}`);
      }
    }
  }

  const byId = new Map(definition.nodes.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Pipeline contains a cycle at ${id}.`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of definition.nodes) visit(node.id);
}

function referenceFor(config: HageezConfig, agent: string): ModelReference {
  return resolveAgentReference(config, agent);
}

export async function runPipeline(
  definition: PipelineDefinition,
  options: PipelineOptions
): Promise<PipelineResult> {
  validatePipeline(definition);
  const projectPath = options.projectPath ?? process.cwd();
  const dryRun = options.dryRun === true;
  const manifest = dryRun
    ? undefined
    : createRun(options.task, projectPath, options.runId);
  const runId = manifest?.runId ?? options.runId ?? 'dry-run';
  emitUIEvent('run:start', { runId, task: options.task });
  const globalLimit = Math.max(1, options.concurrency ?? 3);
  const states = new Map<string, PipelineNodeState>();
  const byId = new Map(definition.nodes.map((node) => [node.id, node]));
  const activeByConnection = new Map<string, number>();
  const active = new Map<string, Promise<void>>();

  for (const node of definition.nodes) {
    states.set(node.id, { node, status: 'pending' });
  }

  const emit = (progress: PipelineProgress): void => {
    options.onProgress?.(progress);
    if (progress.type === 'start') {
      const reference = referenceFor(options.config, progress.agent);
      emitUIEvent('agent:start', {
        id: progress.id,
        agent: progress.agent,
        connection: reference.connection,
        model: reference.model,
      });
    } else if (progress.type === 'success') {
      emitUIEvent('agent:done', {
        id: progress.id,
        agent: progress.agent,
        summary: progress.message,
      });
    } else if (progress.type === 'failed') {
      emitUIEvent('agent:failed', {
        id: progress.id,
        agent: progress.agent,
        error: progress.message || 'failed',
      });
    } else if (progress.type === 'skipped') {
      emitUIEvent('agent:skipped', {
        id: progress.id,
        agent: progress.agent,
        reason: progress.message,
      });
    }
  };

  const recordArtifact = (
    node: PipelineNode,
    status: 'success' | 'failed' | 'skipped',
    output: string,
    result?: AgentRunResult,
    inputs: string[] = []
  ): void => {
    if (dryRun || !manifest) return;
    try {
      writeArtifact(
        runId,
        node.agent,
        output,
        {
          status,
          model: result?.model ?? '',
          connection: result?.connection ?? '',
          inputs,
        },
        projectPath
      );
    } catch {
      // An artifact write failure must not change the pipeline outcome.
    }
  };

  const skipDependents = (failedId: string): void => {
    for (const node of definition.nodes) {
      if (!node.dependsOn.includes(failedId)) continue;
      const state = states.get(node.id)!;
      if (state.status !== 'pending') continue;
      state.status = 'skipped';
      emit({ type: 'skipped', id: node.id, agent: node.agent, message: `dependency ${failedId} failed` });
      skipDependents(node.id);
    }
  };

  const requiredDepsDone = (node: PipelineNode): boolean =>
    node.dependsOn.every((id) => {
      const dependency = states.get(id)!;
      const definitionNode = byId.get(id)!;
      if (dependency.status === 'success') return true;
      if (dependency.status === 'skipped' && definitionNode.optional) return true;
      return false;
    });

  const anyRequiredFailed = (node: PipelineNode): boolean =>
    node.dependsOn.some((id) => {
      const dependency = states.get(id)!;
      const definitionNode = byId.get(id)!;
      return dependency.status === 'failed' ||
        (dependency.status === 'skipped' && !definitionNode.optional);
    });

  while (true) {
    for (const state of states.values()) {
      if (state.status !== 'pending') continue;
      if (anyRequiredFailed(state.node)) {
        state.status = 'skipped';
        emit({ type: 'skipped', id: state.node.id, agent: state.node.agent, message: 'dependency failed' });
      }
    }

    let scheduled = false;
    for (const state of states.values()) {
      if (active.size >= globalLimit) break;
      if (state.status !== 'pending' || !requiredDepsDone(state.node)) continue;
      const reference = referenceFor(options.config, state.node.agent);
      const connection = getConnection(options.config, reference.connection);
      const capacity = connectionConcurrency(options.config, reference.connection);
      const current = activeByConnection.get(reference.connection) ?? 0;
      if (current >= capacity) continue;

      state.status = 'running';
      activeByConnection.set(reference.connection, current + 1);
      emit({ type: 'start', id: state.node.id, agent: state.node.agent });
      scheduled = true;

      const inputs: Record<string, string> = {};
      for (const dependencyId of state.node.dependsOn) {
        const dependency = byId.get(dependencyId)!;
        const dependencyState = states.get(dependencyId)!;
        if (dependencyState.status !== 'success') continue;
        if (!dryRun && manifest) {
          try {
            inputs[dependency.agent] = readArtifact(runId, dependency.agent, projectPath);
          } catch {
            inputs[dependency.agent] = dependencyState.result?.output ?? '';
          }
        } else {
          inputs[dependency.agent] = dependencyState.result?.output ?? '';
        }
      }

      const canWriteProject = state.node.agent === 'build';
      const promise = (async () => {
        try {
          const result = options.execute
            ? await options.execute(state.node, { inputs, canWriteProject, task: options.task, runId })
            : await runAgent(state.node.agent, {
                config: options.config,
                task: options.task,
                projectPath,
                inputs,
                call: options.call,
                dryRun,
              });
          state.result = result;
          if (result.status === 'success') {
            state.status = 'success';
            recordArtifact(
              state.node,
              'success',
              result.output,
              result,
              state.node.dependsOn.map((id) => byId.get(id)!.agent)
            );
            emit({ type: 'success', id: state.node.id, agent: state.node.agent });
          } else if (result.status === 'skipped') {
            state.status = 'skipped';
            recordArtifact(state.node, 'skipped', result.output, result);
            emit({ type: 'skipped', id: state.node.id, agent: state.node.agent, message: result.output });
            if (!state.node.optional) skipDependents(state.node.id);
          } else {
            state.status = 'failed';
            state.error = result.error;
            recordArtifact(state.node, 'failed', result.output || result.error || 'failed', result);
            emit({ type: 'failed', id: state.node.id, agent: state.node.agent, message: result.error });
            skipDependents(state.node.id);
          }
        } catch (err) {
          state.status = 'failed';
          state.error = err instanceof Error ? err.message : String(err);
          recordArtifact(state.node, 'failed', state.error);
          emit({ type: 'failed', id: state.node.id, agent: state.node.agent, message: state.error });
          skipDependents(state.node.id);
        } finally {
          active.delete(state.node.id);
          activeByConnection.set(
            reference.connection,
            Math.max(0, (activeByConnection.get(reference.connection) ?? 1) - 1)
          );
        }
      })();
      active.set(state.node.id, promise);
    }

    if (active.size === 0) {
      const remaining = [...states.values()].filter((state) => state.status === 'pending');
      if (remaining.length === 0 || !scheduled) break;
    } else {
      await Promise.race(active.values());
    }
  }

  const nodeStates = [...states.values()];
  const anyFailed = nodeStates.some((state) => state.status === 'failed');
  const anySkipped = nodeStates.some((state) => state.status === 'skipped' && !state.node.optional);
  const finalStatus = anyFailed ? 'partial' : anySkipped ? 'partial' : 'success';
  const finalManifest = manifest ? finishRun(runId, finalStatus, projectPath) : undefined;
  return { runId, manifest: finalManifest, nodes: nodeStates };
}

export function canWriteProject(agent: string): boolean {
  return agent === 'build';
}
