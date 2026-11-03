import { HageezConfig } from '../core';
import {
  PipelineDefinition,
  PipelineNode,
  PipelineOptions,
  PipelineResult,
  runPipeline,
} from '../orchestrator';
import { AgentRunResult } from '../agents/types';
import {
  highSeverityIssues,
  runAnalystAgent,
  runArchitectAgent,
  runBuildAgent,
  runCodeReviewAgent,
  runPmAgent,
  runProductBriefAgent,
  runProjectContextAgent,
  runQaAgent,
  runRetrospectiveAgent,
  runUxAgent,
  PipelineAgentOptions,
} from './agents';

export const FINAL_PIPELINE: PipelineDefinition = {
  name: 'final',
  nodes: [
    { id: 'analysis', agent: 'analyst', dependsOn: [] },
    { id: 'brief', agent: 'product-brief', dependsOn: ['analysis'] },
    { id: 'plan', agent: 'pm', dependsOn: ['analysis'] },
    { id: 'design', agent: 'architect', dependsOn: ['analysis', 'brief'] },
    { id: 'ux', agent: 'ux-designer', dependsOn: ['brief'], optional: true },
    { id: 'context', agent: 'project-context', dependsOn: ['plan', 'design', 'ux'] },
    { id: 'build', agent: 'build', dependsOn: ['context'] },
    { id: 'review', agent: 'code-review', dependsOn: ['build'] },
    { id: 'qa', agent: 'qa-tests', dependsOn: ['build'] },
    { id: 'retrospective', agent: 'retrospective', dependsOn: ['review', 'qa'] },
  ],
};

export interface FinalPipelineOptions {
  config: HageezConfig;
  task: string;
  projectPath?: string;
  dryRun?: boolean;
  yes?: boolean;
  silent?: boolean;
  fileContext?: string;
  call?: PipelineAgentOptions['call'];
  builderCall?: PipelineAgentOptions['builderCall'];
  reviewerCall?: PipelineAgentOptions['reviewerCall'];
  ask?: PipelineAgentOptions['ask'];
  render?: PipelineAgentOptions['render'];
  runTests?: Parameters<typeof runQaAgent>[0]['runTests'];
  onProgress?: PipelineOptions['onProgress'];
}

function optionsFor(base: FinalPipelineOptions, inputs: Record<string, string>, task: string): PipelineAgentOptions {
  return {
    config: base.config,
    task,
    projectPath: base.projectPath ?? process.cwd(),
    inputs,
    call: base.call,
    builderCall: base.builderCall,
    reviewerCall: base.reviewerCall,
    dryRun: base.dryRun,
    yes: base.yes,
    silent: base.silent,
    ask: base.ask,
    render: base.render ?? (base.silent ? () => {} : undefined),
    fileContext: base.fileContext,
  };
}

function skipped(agent: string, message: string): AgentRunResult {
  return {
    agent,
    status: 'skipped',
    output: message,
    artifacts: [],
    tokens: 0,
    model: '',
    connection: '',
    durationMs: 0,
  };
}

export async function runFinalPipeline(options: FinalPipelineOptions): Promise<PipelineResult> {
  return runPipeline(FINAL_PIPELINE, {
    config: options.config,
    task: options.task,
    projectPath: options.projectPath,
    dryRun: options.dryRun,
    onProgress: options.onProgress,
    execute: async (node: PipelineNode, context) => {
      const base = optionsFor(options, context.inputs, context.task);
      switch (node.agent) {
        case 'analyst':
          return runAnalystAgent(base);
        case 'product-brief':
          return runProductBriefAgent(base);
        case 'pm':
          return runPmAgent(base);
        case 'architect':
          return runArchitectAgent(base);
        case 'ux-designer':
          return runUxAgent(base);
        case 'project-context':
          return runProjectContextAgent(base);
        case 'build':
          return runBuildAgent(base);
        case 'code-review': {
          let review = await runCodeReviewAgent(base);
          for (let attempt = 0; attempt < 2 && highSeverityIssues(review) > 0; attempt += 1) {
            const rebuild = await runBuildAgent(base);
            if (rebuild.status !== 'success') break;
            review = await runCodeReviewAgent(base);
          }
          return review;
        }
        case 'qa-tests':
          return runQaAgent({ ...base, runTests: options.runTests });
        case 'retrospective':
          if (options.dryRun) return skipped('retrospective', 'Skipped in dry-run mode.');
          return runRetrospectiveAgent({ ...base, runId: context.runId });
        default:
          return skipped(node.agent, `No implementation for ${node.agent}.`);
      }
    },
  });
}
