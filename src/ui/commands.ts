import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { HageezConfig } from '../core';

export interface CommandContext {
  config?: HageezConfig;
  output: (line: string) => void;
  setMode?: (mode: 'build' | 'plan') => void;
}

export interface CommandDefinition {
  name: string;
  description: string;
  interactive?: boolean;
  run?: (args: string[], ctx: CommandContext) => Promise<void> | void;
}

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

export async function captureConsoleOutput(fn: () => Promise<void> | void): Promise<string[]> {
  const lines: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;

  console.log = (...args: any[]) => {
    const raw = args.map((a) => (typeof a === 'string' ? a : util.format(a))).join(' ');
    for (const l of raw.split('\n')) {
      const clean = stripAnsi(l);
      if (clean.trim()) lines.push(clean);
    }
  };
  console.error = (...args: any[]) => {
    const raw = args.map((a) => (typeof a === 'string' ? a : util.format(a))).join(' ');
    for (const l of raw.split('\n')) {
      const clean = stripAnsi(l);
      if (clean.trim()) lines.push(clean);
    }
  };
  console.warn = (...args: any[]) => {
    const raw = args.map((a) => (typeof a === 'string' ? a : util.format(a))).join(' ');
    for (const l of raw.split('\n')) {
      const clean = stripAnsi(l);
      if (clean.trim()) lines.push(clean);
    }
  };

  try {
    await fn();
  } finally {
    console.log = origLog;
    console.error = origError;
    console.warn = origWarn;
  }
  return lines;
}

export function parseArgs(args: string[]): { positional: string[]; options: Record<string, string> } {
  const positional: string[] = [];
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        options[key] = args[++i];
      } else {
        options[key] = 'true';
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, options };
}

export const COMMANDS: CommandDefinition[] = [
  {
    name: '/help',
    description: 'Show available commands and keybindings',
    run: (args, ctx) => {
      ctx.output('Available Commands:');
      for (const cmd of COMMANDS) {
        ctx.output(`  ${cmd.name.padEnd(10)} ${cmd.description}`);
      }
      ctx.output('');
      ctx.output('Quick Config & Models:');
      ctx.output('  /connect key <provider> <api-key>  (e.g. /connect key groq gsk_...)');
      ctx.output('  /connect add <name> <type> --key <key> [--model <model>]');
      ctx.output('  /assign --preset mixed             (Light: Ollama, Heavy: Cloud)');
      ctx.output('  /assign <agent> <conn>:<model>     (e.g. /assign build groq:llama-3.3-70b-versatile)');
      ctx.output('  /assign show                       (View all 10 agent assignments)');
      ctx.output('');
      ctx.output('Keybindings:');
      ctx.output('  Tab: Toggle Build/Plan mode | Ctrl+B: Toggle sidebar | Esc: Clear/Interrupt | Ctrl+C: Exit');
    },
  },
  {
    name: '/agents',
    description: 'List registered agents and active models',
    run: async (args, ctx) => {
      const { listAgents } = await import('../commands/agent');
      const lines = await captureConsoleOutput(() => listAgents());
      for (const line of lines) ctx.output(line);
    },
  },
  {
    name: '/assign',
    description: 'Assign models to the ten pipeline agents',
    interactive: true,
    run: async (args, ctx) => {
      const { runAssign } = await import('../commands/assign');
      const { positional, options } = parseArgs(args);

      let agent: string | undefined = positional[0];
      let assignment: string | undefined = positional[1];
      const assignOpts: { all?: string; preset?: string; show?: boolean; reset?: boolean } = {};

      if (options.preset || agent === 'preset') {
        assignOpts.preset = options.preset || assignment || positional[1];
        agent = undefined;
        assignment = undefined;
      } else if (options.all || agent === 'all') {
        assignOpts.all = options.all || assignment || positional[1];
        agent = undefined;
        assignment = undefined;
      } else if (options.reset || agent === 'reset') {
        assignOpts.reset = true;
        agent = undefined;
        assignment = undefined;
      } else if (options.show || agent === 'show' || (!agent && !assignment)) {
        assignOpts.show = true;
        agent = undefined;
        assignment = undefined;
      }

      const lines = await captureConsoleOutput(async () => {
        await runAssign(agent, assignment, assignOpts);
      });
      for (const line of lines) ctx.output(line);
    },
  },
  {
    name: '/connect',
    description: 'Manage named connections (Ollama, cloud)',
    interactive: true,
    run: async (args, ctx) => {
      const {
        runConnectList,
        runConnectAdd,
        runConnectTest,
        runConnectUse,
        runConnectRemove,
        runConnectShow,
      } = await import('../commands/connect');
      const { positional, options } = parseArgs(args);
      const action = positional[0]?.toLowerCase();

      if (!action || action === 'list') {
        const lines = await captureConsoleOutput(() => runConnectList());
        for (const line of lines) ctx.output(line);
        return;
      }

      if (action === 'add') {
        const name = positional[1];
        const type = positional[2];
        if (!name || !type) {
          ctx.output('Usage: /connect add <name> <type> [--key <key>] [--model <model>] [--base-url <url>]');
          return;
        }
        const lines = await captureConsoleOutput(() => {
          runConnectAdd(name, type, {
            key: options.key,
            keyEnv: options['key-env'],
            baseUrl: options['base-url'],
            model: options.model,
            maxConcurrent: options['max-concurrent'],
          });
          console.log(`  ✓ Connection ${name} saved`);
        });
        for (const line of lines) ctx.output(line);
        return;
      }

      if (action === 'key') {
        const name = positional[1];
        const key = positional[2];
        if (!name || !key) {
          ctx.output('Usage: /connect key <name> <api-key>');
          return;
        }
        const { loadConfig, asV2Config } = await import('../core');
        const cfg = asV2Config(loadConfig());
        const type = cfg.connections[name]?.type || name;
        const lines = await captureConsoleOutput(() => {
          runConnectAdd(name, type, { key });
          console.log(`  ✓ API key updated for connection ${name}`);
        });
        for (const line of lines) ctx.output(line);
        return;
      }

      if (action === 'test') {
        const target = positional[1];
        const lines = await captureConsoleOutput(async () => {
          await runConnectTest(target);
        });
        for (const line of lines) ctx.output(line);
        return;
      }

      if (action === 'use') {
        const name = positional[1];
        const model = positional[2] || options.model;
        if (!name) {
          ctx.output('Usage: /connect use <name> [model]');
          return;
        }
        const lines = await captureConsoleOutput(() => runConnectUse(name, model));
        for (const line of lines) ctx.output(line);
        return;
      }

      if (action === 'remove') {
        const name = positional[1];
        if (!name) {
          ctx.output('Usage: /connect remove <name>');
          return;
        }
        const lines = await captureConsoleOutput(() => runConnectRemove(name));
        for (const line of lines) ctx.output(line);
        return;
      }

      if (action === 'show') {
        const name = positional[1];
        const lines = await captureConsoleOutput(() => runConnectShow(name));
        for (const line of lines) ctx.output(line);
        return;
      }

      ctx.output(`Unknown action: ${action}. Use list, add, key, test, use, remove, or show.`);
    },
  },
  {
    name: '/models',
    description: 'Probe and list available models',
    run: async (args, ctx) => {
      if (args[0] === 'add') {
        const connection = args[1];
        const model = args[2];
        if (!connection || !model) {
          ctx.output('Usage: /models add <connection> <model>');
          return;
        }
        const { runModelsAdd } = await import('../commands/models');
        const lines = await captureConsoleOutput(() => runModelsAdd(connection, model));
        for (const line of lines) ctx.output(line);
        return;
      }
      const { runModelsList } = await import('../commands/models');
      const lines = await captureConsoleOutput(() => runModelsList(args[0]));
      for (const line of lines) ctx.output(line);
    },
  },
  {
    name: '/plan',
    description: 'Run the planning pipeline (analyst -> pm)',
    run: async (args, ctx) => {
      if (args.length === 0) {
        ctx.output('Usage: /plan <task description>');
        ctx.setMode?.('plan');
        return;
      }
      const task = args.join(' ');
      ctx.output(`Planning: "${task}"`);
      const { runPlan } = await import('../commands/plan');
      try {
        const planOutput = await runPlan(task, { silent: true });
        if (planOutput) {
          for (const line of planOutput.split('\n')) {
            ctx.output(line);
          }
        }
      } catch (err) {
        ctx.output(`Plan error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  },
  {
    name: '/build',
    description: 'Run the full agent build pipeline',
    run: async (args, ctx) => {
      if (args.length === 0) {
        ctx.output('Usage: /build <task description>');
        ctx.setMode?.('build');
        return;
      }
      const task = args.join(' ');
      ctx.output(`Building: "${task}"`);
      const { runBuild } = await import('../commands/build');
      try {
        await runBuild(task, { silent: true });
      } catch (err) {
        ctx.output(`Build error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  },
  {
    name: '/chat',
    description: 'Start conversational AI assistant session',
    run: async (args, ctx) => {
      if (args.length === 0) {
        ctx.output('Conversational mode active. Ask any question in the input box.');
      } else {
        const question = args.join(' ');
        ctx.output(`You: ${question}`);
        const { callLLM, loadConfig } = await import('../core');
        try {
          const cfg = ctx.config || loadConfig();
          const res = await callLLM(cfg, [
            { role: 'system', content: 'You are HageezAI, a concise and accurate software engineering assistant.' },
            { role: 'user', content: question },
          ]);
          for (const line of res.content.split('\n')) {
            ctx.output(line);
          }
        } catch (err) {
          ctx.output(`Chat error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    },
  },
  {
    name: '/memory',
    description: 'View decisions and recallable memories',
    run: async (args, ctx) => {
      const { runMemory } = await import('../commands/memory');
      const lines = await captureConsoleOutput(() => runMemory(args[0] || 'list', args[1], args[2], {}));
      for (const line of lines) ctx.output(line);
    },
  },
  {
    name: '/skills',
    description: 'List active and project skills',
    run: async (args, ctx) => {
      const { runSkills } = await import('../commands/skills');
      const lines = await captureConsoleOutput(() => runSkills(args[0] || 'list', args[1], {}));
      for (const line of lines) ctx.output(line);
    },
  },
  {
    name: '/diff',
    description: 'Preview unstaged Git changes and diffs',
    run: async (args, ctx) => {
      const { getGitDiff, gitStatus } = await import('../git');
      const status = await gitStatus();
      ctx.output(`Git status: ${status.modified} modified, ${status.staged} staged, ${status.untracked} untracked`);
      const diff = await getGitDiff(false);
      if (!diff.trim()) {
        ctx.output('No unstaged Git changes found.');
      } else {
        const lines = diff.split('\n').slice(0, 50);
        for (const line of lines) ctx.output(line);
        if (diff.split('\n').length > 50) {
          ctx.output('... (diff truncated to 50 lines)');
        }
      }
    },
  },
  {
    name: '/undo',
    description: 'Revert last approved change from backup',
    run: (args, ctx) => {
      const backupDir = path.join(process.cwd(), 'ai-learning', 'backups');
      if (!fs.existsSync(backupDir)) {
        ctx.output('No backups found in ai-learning/backups.');
        return;
      }
      const runs = fs.readdirSync(backupDir).sort().reverse();
      if (runs.length === 0) {
        ctx.output('No previous backups found.');
        return;
      }
      ctx.output(`Latest backup set: ${runs[0]}`);
      ctx.output(`Inspect or restore from ai-learning/backups/${runs[0]}`);
    },
  },
  {
    name: '/doctor',
    description: 'Run full system health and security check',
    run: async (args, ctx) => {
      const { runDoctor } = await import('../commands/doctor');
      const lines = await captureConsoleOutput(() => runDoctor());
      for (const line of lines) ctx.output(line);
    },
  },
];

export function filterCommands(query: string): CommandDefinition[] {
  const clean = query.trim().toLowerCase();
  if (!clean || clean === '/') return [...COMMANDS];

  const prefix = clean.startsWith('/') ? clean : `/${clean}`;

  return COMMANDS.filter((cmd) => {
    return (
      cmd.name.toLowerCase().startsWith(prefix) ||
      cmd.name.toLowerCase().includes(clean.replace(/^\//, '')) ||
      cmd.description.toLowerCase().includes(clean.replace(/^\//, ''))
    );
  });
}

export function findCommand(name: string): CommandDefinition | undefined {
  const normalized = name.startsWith('/') ? name : `/${name}`;
  return COMMANDS.find((cmd) => cmd.name.toLowerCase() === normalized.toLowerCase());
}
