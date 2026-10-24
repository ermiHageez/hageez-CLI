#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { configExists } from './core';
import { printFullDashboard } from './ui/dashboard';
import { theme, VERSION } from './ui/theme';
import { runInit } from './commands/init';
import { runBuild } from './commands/build';
import { runExplain } from './commands/explain';
import { runReview } from './commands/review';
import { runDebug } from './commands/debug';
import { runCommit } from './commands/commit';
import { runDocs } from './commands/docs';
import { runPlan } from './commands/plan';
import { runChat } from './commands/chat';
import { runDoctor } from './commands/doctor';

const program = new Command();

program
  .name('hageez')
  .description('HageezAI — AI Software Engineering Platform that Understands, Builds and Improves with You')
  .version(`HageezAI v${VERSION}`, '-v, --version', 'output the current version');

program
  .command('init')
  .description('Initialize HageezAI in the current project')
  .option('--cursor', 'Generate Cursor IDE integration files')
  .option('--angular', 'Set up Angular skills')
  .action(async (opts: { cursor?: boolean; angular?: boolean }) => {
    await runInit(opts);
  });

program
  .command('build [task]')
  .description('Build a feature — runs the full 7-step AI pipeline')
  .option('--tdd', 'Use test-driven development approach')
  .option('--via-opencode', 'Delegate to opencode CLI')
  .option('--prd', 'Generate a PRD before building')
  .action(async (task: string | undefined, opts: { tdd?: boolean; viaOpencode?: boolean; prd?: boolean }) => {
    await runBuild(task, opts);
  });

program
  .command('explain [target]')
  .description('Explain code — file, function, or concept')
  .action(async (target?: string) => {
    await runExplain(target);
  });

program
  .command('review')
  .description('Review code changes — quality, security, best practices')
  .option('--staged', 'Review only staged git changes')
  .action(async (opts: { staged?: boolean }) => {
    await runReview(opts);
  });

program
  .command('debug [error]')
  .description('Debug errors — detect and fix issues automatically')
  .action(async (errorMsg?: string) => {
    await runDebug(errorMsg);
  });

program
  .command('commit')
  .description('Generate a conventional commit message from staged changes')
  .option('--push', 'Push after committing')
  .action(async (opts: { push?: boolean }) => {
    await runCommit(opts);
  });

program
  .command('docs [target]')
  .description('Generate documentation for a file or the whole project')
  .action(async (target?: string) => {
    await runDocs(target);
  });

program
  .command('plan [task]')
  .description('Create an execution plan for a task')
  .option('--prd', 'Generate a full PRD')
  .option('--tickets', 'Break into tickets/issues')
  .action(async (task: string | undefined, opts: { prd?: boolean; tickets?: boolean }) => {
    await runPlan(task, opts);
  });

program
  .command('chat')
  .description('Start an interactive AI chat session')
  .action(async () => {
    await runChat();
  });

program
  .command('doctor')
  .description('Run system health check — config, git, memory, RAG status')
  .action(async () => {
    await runDoctor();
  });

program
  .command('grill')
  .description('Socratic requirement clarification (mattpocock/skills)')
  .action(async () => {
    const { runPlan } = await import('./commands/plan');
    await runPlan(undefined, { prd: true });
  });

program.action(async () => {
  const configured = configExists();
  if (!configured) {
    console.log('');
    console.log(theme.cyan('  HageezAI is not configured yet.'));
    console.log(chalk.dim('  Run ') + theme.primary('hageez init') + chalk.dim(' to get started.'));
    console.log('');
    return;
  }
  const { loadConfig } = await import('./core');
  let config;
  try { config = loadConfig(); } catch { config = undefined; }

  // Show animated startup
  const { runStartup } = await import('./ui/startup');
  await runStartup({ config });

  const { startRepl } = await import('./ui/repl');
  await startRepl(config);
});

program.parse(process.argv);
