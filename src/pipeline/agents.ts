import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  HageezConfig,
  ProjectContext,
} from '../core';
import { scanProject } from '../filesystem';
import { createPlanner, PlannerModelCall } from '../planner';
import { createBuilder, BuilderModelCall } from '../builder';
import { createReviewer, ReviewerModelCall } from '../reviewer';
import { reviewAndApply, ReviewOptions } from '../commands/approval';
import { runAgent } from '../agents/runtime';
import { AgentRunResult } from '../agents/types';
import { rememberDecision, readSessionLogs } from '../memory';
import { addSkill } from '../skills';
import { readManifest, RunManifest } from '../artifacts';
import { getGitDiff } from '../git';

const execFileAsync = promisify(execFile);

export interface PipelineAgentOptions {
  config: HageezConfig;
  task: string;
  projectPath: string;
  inputs?: Record<string, string>;
  call?: PlannerModelCall;
  builderCall?: BuilderModelCall;
  reviewerCall?: ReviewerModelCall;
  dryRun?: boolean;
  yes?: boolean;
  silent?: boolean;
  ask?: ReviewOptions['ask'];
  render?: ReviewOptions['render'];
  isTTY?: boolean;
  fileContext?: string;
}

function success(agent: string, output: string, artifacts: string[], tokens = 0): AgentRunResult {
  return {
    agent,
    status: 'success',
    output,
    artifacts,
    tokens,
    model: '',
    connection: '',
    durationMs: 0,
  };
}

function failed(agent: string, error: string): AgentRunResult {
  return {
    agent,
    status: 'failed',
    output: '',
    artifacts: [],
    tokens: 0,
    error,
    model: '',
    connection: '',
    durationMs: 0,
  };
}

function projectSummary(project: ProjectContext): string {
  return [
    `Project: ${project.name}`,
    `Language: ${project.language ?? 'unknown'}`,
    `Framework: ${project.framework ?? 'unknown'}`,
    `Database: ${project.database ?? 'unknown'}`,
    `Build tool: ${project.buildTool ?? 'unknown'}`,
    `Files: ${project.filesScanned}`,
    `Lines: ${project.linesOfCode}`,
    `Dependencies: ${project.dependencies}`,
  ].join('\n');
}

export async function runAnalystAgent(options: PipelineAgentOptions): Promise<AgentRunResult> {
  try {
    const project = await scanProject(options.projectPath);
    const planner = createPlanner(options.config, options.call);
    const intent = await planner.analyzeIntent(options.task, project);
    const output = `# Analysis\n\n## Project\n${projectSummary(project)}\n\n## Intent\n${intent.content}\n\n## Requirements\n- Deliver the requested task: ${options.task}\n- Respect the existing project conventions.\n\n## MVP Scope\n- Implement the smallest coherent change and verify it.\n`;
    return success('analyst', output, ['analysis'], intent.tokensUsed);
  } catch (err) {
    return failed('analyst', err instanceof Error ? err.message : String(err));
  }
}

export async function runPmAgent(options: PipelineAgentOptions): Promise<AgentRunResult> {
  try {
    const project = await scanProject(options.projectPath);
    const planner = createPlanner(options.config, options.call);
    const analysis = options.inputs?.analysis ?? options.task;
    const plan = await planner.createPlan(options.task, project, analysis);
    const output = `# Plan\n\n${plan.content}\n\n## Dependencies\n- Follow the ordered tasks above.\n- Build after project context is ready.\n`;
    return success('pm', output, ['plan'], plan.tokensUsed);
  } catch (err) {
    return failed('pm', err instanceof Error ? err.message : String(err));
  }
}

export async function runBuildAgent(options: PipelineAgentOptions): Promise<AgentRunResult> {
  try {
    const project = await scanProject(options.projectPath);
    const plan = options.inputs?.plan ?? options.task;
    const builder = createBuilder(options.config, options.builderCall);
    const built = await builder.generate(options.task, project, plan, options.fileContext);
    const applied = await reviewAndApply(built.files, options.projectPath, {
      yes: options.yes,
      dryRun: options.dryRun,
      ask: options.ask,
      render: options.render,
      isTTY: options.isTTY,
    });
    const lines = [
      '# Changes',
      '',
      `Files generated: ${built.files.length}`,
      '',
      ...built.files.map((file) => `- ${file.action}: ${file.path}`),
      '',
      `Written: ${applied.written.length}`,
      `Rejected: ${applied.rejected.length}`,
      `Errors: ${applied.errors.length}`,
    ];
    if (applied.errors.length > 0) {
      return {
        ...failed('build', applied.errors.join('; ')),
        output: lines.join('\n'),
        artifacts: ['changes'],
      };
    }
    return success('build', lines.join('\n'), ['changes'], built.tokensUsed);
  } catch (err) {
    return failed('build', err instanceof Error ? err.message : String(err));
  }
}

async function collectActualDiff(projectPath: string): Promise<string> {
  const tracked = await getGitDiff(false, projectPath);
  const parts = [tracked];
  try {
    const status = await execFileAsync('git', ['status', '--porcelain'], { cwd: projectPath });
    for (const line of status.stdout.split(/\r?\n/)) {
      if (!line.startsWith('?? ')) continue;
      const relative = line.slice(3).trim();
      const file = path.join(projectPath, relative);
      try {
        const content = fs.readFileSync(file, 'utf-8');
        parts.push(`--- /dev/null\n+++ b/${relative}\n@@\n${content.split('\n').map((line) => `+${line}`).join('\n')}`);
      } catch {
        // Skip unreadable untracked entries.
      }
    }
  } catch {
    // Not a git repository: the tracked diff is empty and review can still use the build diff.
  }
  return parts.filter(Boolean).join('\n');
}

export async function runCodeReviewAgent(
  options: PipelineAgentOptions & { diff?: string }
): Promise<AgentRunResult> {
  try {
    const project = await scanProject(options.projectPath);
    const diff = options.diff ?? await collectActualDiff(options.projectPath);
    const reviewer = createReviewer(options.config, options.reviewerCall);
    const review = await reviewer.review(diff || options.inputs?.changes || '', project);
    const issues = review.issues.map((issue) => ({
      severity: issue.severity === 'error' ? 'high' : issue.severity === 'warn' ? 'medium' : 'low',
      message: issue.message,
    }));
    const output = `# Review\n\n## Issues\n\`\`\`json\n${JSON.stringify(issues, null, 2)}\n\`\`\`\n`;
    return success('code-review', output, ['review'], review.tokensUsed);
  } catch (err) {
    return failed('code-review', err instanceof Error ? err.message : String(err));
  }
}

export function highSeverityIssues(review: AgentRunResult): number {
  if (review.status !== 'success') return 0;
  try {
    const match = /```json\s*([\s\S]*?)```/.exec(review.output);
    if (!match) return 0;
    const issues = JSON.parse(match[1]) as Array<{ severity?: string }>;
    return issues.filter((issue) => issue.severity === 'critical' || issue.severity === 'high').length;
  } catch {
    return 0;
  }
}

export async function runProductBriefAgent(options: PipelineAgentOptions): Promise<AgentRunResult> {
  return runAgent('product-brief', {
    config: options.config,
    task: `${options.task}\n\nAsk Socratic questions grounded in this analysis, then write the brief:\n${options.inputs?.analysis ?? ''}`,
    projectPath: options.projectPath,
    inputs: options.inputs,
    call: options.call as never,
  });
}

export async function runArchitectAgent(options: PipelineAgentOptions): Promise<AgentRunResult> {
  const result = await runAgent('architect', {
    config: options.config,
    task: options.task,
    projectPath: options.projectPath,
    inputs: options.inputs,
    call: options.call as never,
  });
  if (result.status !== 'success') return result;
  const draft = /draft adr/i.test(result.output)
    ? ''
    : '\n\n## Draft ADRs\n- Draft ADR: Record the selected architecture and trade-offs after approval.\n';
  return { ...result, output: `${result.output}${draft}` };
}

const FRONTEND_FRAMEWORKS = /react|vue|angular|svelte|next|nuxt|solid|astro/i;
const UI_TASK = /\b(ui|ux|screen|page|component|layout|responsive|accessib|design|frontend)\b/i;

export function uxTriggered(project: ProjectContext, task: string): boolean {
  return FRONTEND_FRAMEWORKS.test(project.framework ?? '') || UI_TASK.test(task);
}

export async function runUxAgent(options: PipelineAgentOptions): Promise<AgentRunResult> {
  try {
    const project = await scanProject(options.projectPath);
    if (!uxTriggered(project, options.task)) {
      return {
        agent: 'ux-designer',
        status: 'skipped',
        output: 'UX work is not applicable: no frontend framework or UI trigger was detected.',
        artifacts: [],
        tokens: 0,
        model: '',
        connection: '',
        durationMs: 0,
      };
    }
    return runAgent('ux-designer', {
      config: options.config,
      task: options.task,
      projectPath: options.projectPath,
      inputs: options.inputs,
      call: options.call as never,
    });
  } catch (err) {
    return {
      agent: 'ux-designer',
      status: 'skipped',
      output: `UX agent failed but does not block the pipeline: ${err instanceof Error ? err.message : String(err)}`,
      artifacts: [],
      tokens: 0,
      model: '',
      connection: '',
      durationMs: 0,
    };
  }
}

export async function runProjectContextAgent(options: PipelineAgentOptions): Promise<AgentRunResult> {
  const result = await runAgent('project-context', {
    config: options.config,
    task: options.task,
    projectPath: options.projectPath,
    inputs: options.inputs,
    call: options.call as never,
  });
  if (result.status !== 'success') return result;
  const conflicts = Object.entries(options.inputs ?? {})
    .flatMap(([name, value]) => value.split(/\r?\n/)
      .filter((line) => /\bconflict\b/i.test(line))
      .map((line) => `- ${name}: ${line.trim()}`));
  const section = conflicts.length > 0
    ? `## Conflicts\n${conflicts.join('\n')}\n- Resolution: Resolve each conflict in favor of the latest upstream artifact and record the chosen value in the build context.\n`
    : '## Conflicts\n- No upstream conflicts detected.\n- Resolution: None required.\n';
  return { ...result, output: `${result.output}\n\n${section}` };
}

export function detectTestCommand(projectPath: string): { command: string; args: string[] } | null {
  const packageFile = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf-8')) as { scripts?: Record<string, string> };
      if (pkg.scripts?.test) return { command: 'npm', args: ['test'] };
    } catch { /* fall through */ }
  }
  if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) return { command: 'cargo', args: ['test'] };
  if (fs.existsSync(path.join(projectPath, 'go.mod'))) return { command: 'go', args: ['test', './...'] };
  if (fs.existsSync(path.join(projectPath, 'pytest.ini')) || fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
    return { command: 'pytest', args: [] };
  }
  if (fs.existsSync(path.join(projectPath, 'pom.xml'))) return { command: 'mvn', args: ['test'] };
  return null;
}

export interface QaRunOptions extends PipelineAgentOptions {
  runTests?: (command: string, args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;
}

export function extractTestFiles(output: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const pattern = /###\s+([A-Za-z0-9._/-]+)\s*\r?\n```[^\n]*\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(output)) !== null) {
    files.push({ path: match[1].trim(), content: match[2] });
  }
  return files;
}

export async function runQaAgent(options: QaRunOptions): Promise<AgentRunResult> {
  try {
    const generated = await runAgent('qa-tests', {
      config: options.config,
      task: `${options.task}\n\nReturn each test file as "### relative/path" followed by one fenced code block.`,
      projectPath: options.projectPath,
      inputs: options.inputs,
      call: options.call as never,
    });
    if (generated.status !== 'success') return generated;
    const detected = detectTestCommand(options.projectPath);
    if (!detected) {
      return failed('qa-tests', 'No test command detected. Add a test script or run the tests manually.');
    }
    if (options.dryRun) {
      return {
        agent: 'qa-tests',
        status: 'skipped',
        output: `Dry run: would run ${detected.command} ${detected.args.join(' ')}.`,
        artifacts: ['qa'],
        tokens: generated.tokens,
        model: generated.model,
        connection: generated.connection,
        durationMs: 0,
      };
    }
    const testFiles = extractTestFiles(generated.output);
    let written = 0;
    if (testFiles.length > 0) {
      const applied = await reviewAndApply(
        testFiles.map((file) => ({ path: file.path, action: 'create' as const, content: file.content })),
        options.projectPath,
        { yes: options.yes, dryRun: options.dryRun, ask: options.ask, render: options.render, isTTY: options.isTTY }
      );
      written = applied.written.length;
      if (applied.errors.length > 0) {
        return failed('qa-tests', applied.errors.join('; '));
      }
    }
    const run = options.runTests ?? (async (command, args) => {
      try {
        const result = await execFileAsync(command, args, {
          cwd: options.projectPath,
          timeout: 120000,
          maxBuffer: 4 * 1024 * 1024,
        });
        return { code: 0, stdout: result.stdout, stderr: result.stderr };
      } catch (err) {
        const failure = err as { code?: number; stdout?: string; stderr?: string };
        return {
          code: typeof failure.code === 'number' ? failure.code : 1,
          stdout: failure.stdout ?? '',
          stderr: failure.stderr ?? String(err),
        };
      }
    });
    const result = await run(detected.command, detected.args);
    const testPaths = testFiles.map((file) => file.path).join(', ') || 'none';
    const output = `# QA\n\nCommand: ${detected.command} ${detected.args.join(' ')}\nStatus: ${result.code === 0 ? 'pass' : 'fail'}\nTest files written: ${written}\nGenerated test paths: ${testPaths}\n\n## Output\n\`\`\`\n${(result.stdout + '\n' + result.stderr).trim().slice(0, 4000)}\n\`\`\`\n`;
    return {
      ...success('qa-tests', output, ['qa'], generated.tokens),
      status: result.code === 0 ? 'success' : 'failed',
      error: result.code === 0 ? undefined : `Tests failed with exit code ${result.code}.`,
    };
  } catch (err) {
    return failed('qa-tests', err instanceof Error ? err.message : String(err));
  }
}

export async function runRetrospectiveAgent(
  options: PipelineAgentOptions & { runId: string; manifest?: RunManifest }
): Promise<AgentRunResult> {
  try {
    const manifest = options.manifest ?? readManifest(options.runId, options.projectPath);
    const completed = manifest.artifacts.filter((artifact) => artifact.status === 'success').length;
    const failed = manifest.artifacts.filter((artifact) => artifact.status === 'failed').length;
    const sessions = readSessionLogs(options.projectPath).slice(-5);
    const sessionSummary = sessions.length > 0
      ? sessions.map((session) => `${session.outcome} (${session.durationMs}ms, ${session.steps.length} steps)`).join('; ')
      : 'no Session Log entries';
    const key = `retro-${options.runId}`;
    const value = `Run ${options.runId} for "${manifest.task}": ${completed} artifact(s) succeeded, ${failed} failed. Recent sessions: ${sessionSummary}.`;
    await rememberDecision(key, value, options.projectPath);
    if (failed > 0) {
      addSkill(
        `retro-${options.runId}`,
        `Runs with failures should add a verification step before finishing. ${failed} agent(s) failed in ${options.runId}.`,
        { agents: ['build', 'qa-tests'], description: 'Retrospective candidate skill' },
        options.projectPath
      );
    }
    return success('retrospective', `# Retrospective\n\n- Decision: ${key}\n- ${value}\n`, ['retrospective']);
  } catch (err) {
    return failed('retrospective', err instanceof Error ? err.message : String(err));
  }
}
