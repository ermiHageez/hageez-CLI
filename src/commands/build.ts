import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { loadConfig } from '../core';
import { theme, label, separator } from '../ui/theme';
import { renderSteps, renderSummary, ProgressStep } from '../ui/progress';
import { logSession } from '../memory';
import { printAgentTable } from '../agents/assignment';
import { runFinalPipeline } from '../pipeline';
import { PipelineNodeState } from '../orchestrator';
import { parseFileReferences, buildFileContext, stripFileRefs } from '../ui/filerefs';
import { isSmallTalk } from '../ui/repl';

export interface BuildOptions {
  viaOpencode?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  silent?: boolean;
}

export function ensureAiLearningDir(): void {
  const base = path.join(process.cwd(), 'ai-learning');
  const dirs = [
    base,
    path.join(base, 'session_logs'),
    path.join(base, 'dataset', 'raw'),
    path.join(base, 'dataset', 'cleaned'),
    path.join(base, 'metadata'),
    path.join(base, 'memory'),
    path.join(base, 'embeddings', 'index'),
    path.join(base, 'exports'),
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
  const gitignore = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignore)) {
    const content = fs.readFileSync(gitignore, 'utf-8');
    if (!content.includes('ai-learning/')) {
      fs.appendFileSync(gitignore, '\n# HageezAI — auto-generated, do not commit\nai-learning/\n');
    }
  }
}

async function promptTask(): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.hex('#39FF14')('>') + ' ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export const BUILD_STEPS: Array<{ label: string }> = [
  { label: 'Scanning project & collecting context' },
  { label: 'Understanding request' },
  { label: 'Creating execution plan' },
  { label: 'Generating & modifying code' },
  { label: 'Applying file changes' },
  { label: 'Reviewing & refining' },
];

export async function runBuild(task: string | undefined, opts: BuildOptions): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch {
    console.log('');
    console.log(theme.primary('  HageezAI not configured.'));
    console.log(chalk.dim('  Run ') + theme.cyan('hageez init') + chalk.dim(' to set up.'));
    return;
  }

  if (!task) {
    if (process.stdin.isTTY !== true) {
      console.log(theme.red('  Error: a task is required in a non-interactive terminal.'));
      process.exitCode = 1;
      return;
    }
    console.log('');
    console.log(label('  Project : ') + theme.cyan(path.basename(process.cwd())));
    task = await promptTask();
    if (!task) {
      console.log(chalk.dim('  No task provided.'));
      return;
    }
  }

  if (isSmallTalk(task)) {
    console.log(theme.yellow('  Notice: Build requires a clear software engineering task.'));
    console.log(chalk.dim('  For conversational questions and small talk, use: ') + theme.cyan('hageez chat'));
    const { runChat } = await import('./chat');
    await runChat();
    return;
  }

  if (!opts.silent) {
    printAgentTable(config);
  }

  if (!opts.yes && !opts.dryRun && process.stdin.isTTY !== true) {
    console.log(theme.red('  Error: refusing to write in a non-interactive terminal without --yes.'));
    console.log(chalk.dim('  Use --yes to approve all changes or --dry-run to preview only.'));
    process.exitCode = 1;
    return;
  }

  const projectRoot = process.cwd();
  const cleanTask = stripFileRefs(task);

  if (!opts.silent) {
    console.log('');
    console.log(theme.cyan(`  Building: `) + chalk.white(`"${cleanTask || task}"`));
  }

  if (opts.viaOpencode) {
    if (opts.dryRun) {
      console.log(theme.red('  Error: --dry-run cannot be combined with --via-opencode.'));
      process.exitCode = 1;
      return;
    }
    console.log(chalk.dim('  Delegating to opencode...'));
    try {
      const { runViaOpencode } = await import('../tools');
      await runViaOpencode(task);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(theme.red(`  Error: ${message}`));
      process.exitCode = 1;
    }
    return;
  }

  console.log('');

  const startTime = Date.now();
  let tokensUsed = 0;
  const steps: ProgressStep[] = BUILD_STEPS.map((s, i) => ({
    id: i,
    label: s.label,
    status: 'pending',
  }));

  const renderProgress = (): void => {
    console.log('');
    console.log(theme.cyan(`  hageez > `) + chalk.white(cleanTask || task));
    console.log('');
    console.log(renderSteps(steps));
    console.log('');
  };

  const saveSession = async (
    outcome: 'success' | 'partial' | 'failed',
    errorMessage?: string
  ): Promise<void> => {
    if (opts.dryRun) return;
    try {
      await logSession({
        command: 'build',
        task: cleanTask || task,
        steps: steps.map((step) => ({ ...step })),
        tokensUsed,
        durationMs: Date.now() - startTime,
        outcome,
        error: errorMessage,
        projectPath: projectRoot,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(chalk.yellow(`  Warning: could not write the session log: ${message}`));
    }
  };

  try {
    if (!opts.silent) {
      renderProgress();
    }
    const fileRefs = parseFileReferences(task, projectRoot);
    const fileContext = buildFileContext(fileRefs);
    if (!opts.silent && fileRefs.length > 0) {
      console.log('');
      console.log(theme.cyan('  Referenced files:'));
      for (const ref of fileRefs) {
        const status = ref.resolved ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${status} ${ref.pattern}`);
      }
    }

    const result = await runFinalPipeline({
      config,
      task: cleanTask || task,
      projectPath: projectRoot,
      dryRun: opts.dryRun,
      yes: opts.yes,
      silent: opts.silent,
      fileContext,
      onProgress: (progress) => {
        if (!opts.silent) {
          if (progress.type === 'start') {
            console.log(chalk.cyan(`  → ${progress.agent}`));
          } else if (progress.type === 'success') {
            console.log(chalk.green(`  ✓ ${progress.agent}`));
          } else if (progress.type === 'failed') {
            console.log(chalk.red(`  ✗ ${progress.agent}: ${progress.message ?? 'failed'}`));
          } else {
            console.log(chalk.yellow(`  ○ ${progress.agent}: ${progress.message ?? 'skipped'}`));
          }
        }
        const next = steps.find((step) => step.status === 'pending');
        if (next) next.status = 'done';
      },
    });
    const nodes = result.nodes;
    tokensUsed = nodes.reduce((sum, node) => sum + (node.result?.tokens ?? 0), 0);
    for (const step of steps) step.status = 'done';

    const failed = nodes.filter((node) => node.status === 'failed');
    const skipped = nodes.filter((node) => node.status === 'skipped');
    const buildNode = nodes.find((node) => node.node.agent === 'build');
    const reviewNode = nodes.find((node) => node.node.agent === 'code-review');
    const status: 'success' | 'partial' =
      failed.length > 0 || skipped.some((node) => !node.node.optional) ? 'partial' : 'success';

    if (opts.dryRun) {
      if (!opts.silent) {
        console.log('');
        console.log(theme.cyan('  Dry run complete — no files written.'));
      }
    } else {
      ensureAiLearningDir();
      if (!opts.silent) {
        console.log(renderSummary(tokensUsed, Date.now() - startTime, status));
      }
      await saveSession(status, failed.map((node) => node.error ?? node.node.agent).join('; ') || undefined);
    }

    if (buildNode?.result?.status === 'failed') {
      if (!opts.silent) {
        console.log(theme.red(`  Build failed: ${buildNode.result.error ?? 'unknown error'}`));
      }
      process.exitCode = 1;
    }
    if (reviewNode?.result?.output && !opts.silent) {
      console.log(separator());
      console.log('');
      console.log(theme.cyan('  Review Notes:'));
      console.log(chalk.dim(reviewNode.result.output.slice(0, 1200)));
      console.log('');
    }
    if (result.manifest && !opts.silent) {
      console.log(chalk.dim(`  Artifacts: ai-learning/runs/${result.manifest.runId}/`));
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    for (const step of steps) if (step.status === 'running') step.status = 'error';
    if (!opts.silent) {
      renderProgress();
      console.log(renderSummary(tokensUsed, Date.now() - startTime, 'error'));
      console.log('');
      console.log(chalk.dim(`  Error: ${errMsg}`));
    }
    await saveSession('failed', errMsg);
    process.exitCode = 1;
  }
}
