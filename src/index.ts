#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { configExists } from './core';
import { printFullDashboard } from './ui/dashboard';
import { theme, VERSION, success } from './ui/theme';
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
import { runConnectAdd, runConnectList, runConnectRemove, runConnectShow, runConnectTest, runConnectUse } from './commands/connect';
import { runModels } from './commands/models';
import { runAgentCommand, listAgents } from './commands/agent';
import { runAssign } from './commands/assign';
import { runMemory } from './commands/memory';
import { runSkills } from './commands/skills';

const program = new Command();

program
  .name('hageez')
  .description('HageezAI — AI Software Engineering Platform that Understands, Builds and Improves with You')
  .version(`HageezAI v${VERSION}`, '-v, --version', 'output the current version')
  .option('--no-tui', 'Disable full-screen TUI and use classic line-based REPL');

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
  .description('Build a feature — runs the full multi-agent pipeline')
  .option('--via-opencode', 'Delegate to opencode CLI')
  .option('--yes', 'Approve every file change without prompting')
  .option('--dry-run', 'Preview diffs without writing, backing up, or logging a session')
  .action(async (task: string | undefined, opts: { viaOpencode?: boolean; yes?: boolean; dryRun?: boolean }) => {
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
  .command('connect')
  .description('Manage named LLM connections')
  .argument('[action]', 'add, list, show, test, use, or remove')
  .argument('[name]', 'connection name')
  .argument('[type]', 'connection type for add')
  .option('--key <key>', 'inline API key (prefer --key-env)')
  .option('--key-env <variable>', 'environment variable holding the API key')
  .option('--base-url <url>', 'provider base URL')
  .option('--model <model>', 'default model or catalog entry')
  .option('--max-concurrent <count>', 'maximum concurrent requests')
  .action(async (action?: string, name?: string, type?: string, opts: { key?: string; keyEnv?: string; baseUrl?: string; model?: string; maxConcurrent?: string } = {}) => {
    try {
      switch (action) {
        case 'add':
          if (!name || !type) throw new Error('Usage: hageez connect add <name> <type>');
          runConnectAdd(name, type, opts);
          console.log(success(`  ✓ Connection ${name} saved`));
          break;
        case 'list':
        case undefined:
          runConnectList();
          break;
        case 'show':
          runConnectShow(name);
          break;
        case 'test':
          await runConnectTest(name);
          break;
        case 'use':
          if (!name) throw new Error('Usage: hageez connect use <name> [model]');
          runConnectUse(name, type || opts.model);
          break;
        case 'remove':
          if (!name) throw new Error('Usage: hageez connect remove <name>');
          runConnectRemove(name);
          break;
        default:
          throw new Error(`Unknown connect action: ${action}`);
      }
    } catch (err) {
      console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
    }
  });

program
  .command('models [connection]')
  .description('List or edit a connection model catalog')
  .option('--add <model>', 'add a model to the catalog')
  .option('--reset', 'reset the catalog to provider defaults')
  .action((connection: string | undefined, opts: { add?: string; reset?: boolean }) => {
    try {
      runModels(connection, opts);
    } catch (err) {
      console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
    }
  });


program
  .command('agent')
  .description('Run or list named agents')
  .argument('[action]', 'run or list')
  .argument('[name]', 'agent name')
  .argument('[task]', 'task text')
  .option('--dry-run', 'Print the agent-to-model table without calling a model')
  .option('--agent-model <assignment>', 'Override one agent as <agent>=<connection>:<model>')
  .action(async (action: string | undefined, name: string | undefined, task: string | undefined, opts: { dryRun?: boolean; agentModel?: string }) => {
    try {
      if (action === 'list' || action === undefined) {
        listAgents();
        return;
      }
      if (action !== 'run') throw new Error(`Unknown agent action: ${action}`);
      if (!name) throw new Error('Usage: hageez agent run <name> "task"');
      await runAgentCommand(name, task, opts);
    } catch (err) {
      console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
      process.exitCode = 1;
    }
  });

program
  .command('assign [agent] [assignment]')
  .description('Assign connections and models to agents')
  .option('--all <assignment>', 'assign every agent to <connection>:<model>')
  .option('--preset <preset>', 'apply local, cloud, or mixed')
  .option('--show', 'show the agent-to-model table')
  .option('--reset', 'clear all agent assignments')
  .action(async (agent: string | undefined, assignment: string | undefined, opts: { all?: string; preset?: string; show?: boolean; reset?: boolean }) => {
    try {
      await runAssign(agent, assignment, opts);
    } catch (err) {
      console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
      process.exitCode = 1;
    }
  });

program
  .command('memory [action] [key] [value]')
  .description('List, add, remove, or debug project Decisions')
  .option('--keyword <text>', 'filter Decisions by keyword')
  .option('--debug', 'show recall metadata without calling a model')
  .action(async (action: string | undefined, key: string | undefined, value: string | undefined, opts: { keyword?: string; debug?: boolean }) => {
    try {
      await runMemory(action, key, value, opts);
    } catch (err) {
      console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
      process.exitCode = 1;
    }
  });

program
  .command('skills [action] [name]')
  .description('List, add, enable, or disable project and global Skills')
  .option('--scope <scope>', 'project or global')
  .option('--description <text>', 'skill description')
  .option('--agents <list>', 'comma-separated applicable agent ids')
  .option('--content <text>', 'skill markdown body')
  .option('--file <path>', 'read the skill body from a file')
  .action(async (action: string | undefined, name: string | undefined, opts: { scope?: string; description?: string; agents?: string; content?: string; file?: string }) => {
    try {
      await runSkills(action, name, opts);
    } catch (err) {
      console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
      process.exitCode = 1;
    }
  });

program
  .command('doctor')
  .description('Run system health check — config, git, memory, RAG status')
  .action(async () => {
    await runDoctor();
  });

program
  .command('grill [task]')
  .description('Socratic requirement clarification via the product-brief agent')
  .action(async (task?: string) => {
    await runAgentCommand('product-brief', task, {});
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

  const opts = program.opts();
  const useTui = process.stdout.isTTY && !process.env.CI && opts.tui !== false;

  if (useTui) {
    const { startFullScreenTui } = await import('./ui/layout');
    await startFullScreenTui(config);
    return;
  }

  // Show animated startup with a real project scan
  const { runStartup } = await import('./ui/startup');
  const { scanProject } = await import('./filesystem');
  let project;
  try { project = await scanProject(process.cwd()); } catch { project = undefined; }
  await runStartup({ config, project });

  const { startRepl } = await import('./ui/repl');
  await startRepl(config);
});

program.parse(process.argv);
