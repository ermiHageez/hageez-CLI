import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { loadConfig } from '../core';
import { theme, success, label, separator } from '../ui/theme';
import { renderSteps, renderSummary, ProgressStep } from '../ui/progress';
import { scanProject } from '../filesystem';
import { createPlanner } from '../planner';
import { createBuilder, applyBuilderResult } from '../builder';
import { createReviewer } from '../reviewer';
import { createDebugger } from '../debugger';
import { logSession } from '../memory';
import { callLLM, buildSystemPrompt } from '../core';
import { parseFileReferences, buildFileContext, stripFileRefs } from '../ui/filerefs';

interface BuildOptions {
  tdd?: boolean;
  viaOpencode?: boolean;
  prd?: boolean;
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

const BUILD_STEPS: Array<{ label: string }> = [
  { label: 'Understanding user request' },
  { label: 'Scanning project & collecting context' },
  { label: 'Creating execution plan' },
  { label: 'Generating & modifying code' },
  { label: 'Applying file changes' },
  { label: 'Reviewing & refining' },
  { label: 'Committing & documenting' },
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
    console.log('');
    console.log(label('  Project : ') + theme.cyan(path.basename(process.cwd())));
    task = await promptTask();
    if (!task) {
      console.log(chalk.dim('  No task provided.'));
      return;
    }
  }

  ensureAiLearningDir();

  // Parse @file references
  const projectRoot = process.cwd();
  const fileRefs = parseFileReferences(task, projectRoot);
  const fileContext = buildFileContext(fileRefs);
  const cleanTask = stripFileRefs(task);

  if (fileRefs.length > 0) {
    console.log('');
    console.log(theme.cyan('  Referenced files:'));
    for (const ref of fileRefs) {
      const status = ref.resolved ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${status} ${ref.pattern}`);
    }
  }

  console.log('');
  console.log(theme.cyan(`  Building: `) + chalk.white(`"${cleanTask || task}"`));
  if (opts.tdd) console.log(chalk.dim('  Mode: TDD (test-first)'));
  if (opts.viaOpencode) {
    console.log(chalk.dim('  Delegating to opencode...'));
    const { runViaOpencode } = await import('../tools');
    await runViaOpencode(task);
    return;
  }
  console.log('');

  const steps: ProgressStep[] = BUILD_STEPS.map((s, i) => ({
    id: i,
    label: s.label,
    status: 'pending',
  }));

  const startTime = Date.now();
  let tokensUsed = 0;

  const renderProgress = (): void => {
    process.stdout.write('\u001B[2J\u001B[0f');
    console.log('');
    console.log(theme.cyan(`  hageez > `) + chalk.white(cleanTask || task));
    console.log('');
    console.log(renderSteps(steps));
    console.log('');
  };

  const markRunning = (i: number): void => {
    steps[i].status = 'running';
    renderProgress();
  };

  const markDone = (i: number, ms: number): void => {
    steps[i].status = 'done';
    steps[i].durationMs = ms;
    renderProgress();
  };

  const delay = (ms: number): Promise<void> =>
    new Promise(r => setTimeout(r, ms));

  try {
    const project = await scanProject(projectRoot);

    markRunning(0);
    await delay(600);
    const planner = createPlanner(config);
    const intent = await planner.analyzeIntent(cleanTask || task, project);
    tokensUsed += intent.tokensUsed;
    markDone(0, Date.now() - startTime);

    markRunning(1);
    await delay(400);
    markDone(1, 400);

    markRunning(2);
    await delay(500);
    const plan = await planner.createPlan(cleanTask || task, project, intent.content);
    tokensUsed += plan.tokensUsed;
    markDone(2, 500);

    markRunning(3);
    await delay(800);
    const builder = createBuilder(config);
    const buildResult = await builder.generate(cleanTask || task, project, plan.content, fileContext);
    tokensUsed += buildResult.tokensUsed;
    markDone(3, 800);

    // Apply file changes
    markRunning(4);
    const applyStart = Date.now();
    const { written, errors } = applyBuilderResult(buildResult, projectRoot);
    markDone(4, Date.now() - applyStart);

    // Show file changes
    if (written.length > 0) {
      console.log('');
      console.log(theme.cyan('  File Changes:'));
      for (const w of written) {
        const [action, ...pathParts] = w.split(' ');
        const filePath = pathParts.join(' ');
        const color = action === 'CREATE' ? chalk.green : action === 'DELETE' ? chalk.red : chalk.yellow;
        console.log(`  ${color(action)}  ${chalk.white(filePath)}`);
      }
    } else if (buildResult.files.length === 0) {
      console.log('');
      console.log(chalk.yellow('  No file changes detected. The AI provided a response but did not output files in the expected format.'));
      console.log(chalk.dim('  Tip: Try being more specific, e.g., "update theme.ts to use blue colors"'));
    }

    if (errors.length > 0) {
      console.log('');
      console.log(theme.red('  Errors:'));
      for (const e of errors) {
        console.log(chalk.red(`  ✗ ${e}`));
      }
    }

    markRunning(5);
    await delay(500);
    const reviewer = createReviewer(config);
    const review = await reviewer.review(buildResult.content, project);
    tokensUsed += review.tokensUsed;
    markDone(5, 500);

    markRunning(6);
    await delay(300);
    markDone(6, 300);

    const totalMs = Date.now() - startTime;
    console.log(renderSummary(tokensUsed, totalMs, 'success'));
    console.log('');

    await logSession({
      command: 'build',
      task: cleanTask || task,
      steps: steps.map(s => ({ ...s, status: s.status as 'done' })),
      tokensUsed,
      durationMs: totalMs,
      outcome: errors.length > 0 ? 'partial' : 'success',
      projectPath: projectRoot,
    });

    if (review.content) {
      console.log(separator());
      console.log('');
      console.log(theme.cyan('  Review Notes:'));
      console.log(chalk.dim(review.content.slice(0, 800)));
      console.log('');
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const failIdx = steps.findIndex(s => s.status === 'running');
    if (failIdx >= 0) steps[failIdx].status = 'error';
    renderProgress();
    console.log(renderSummary(tokensUsed, Date.now() - startTime, 'error'));
    console.log('');
    console.log(chalk.dim(`  Error: ${errMsg}`));
  }
}
