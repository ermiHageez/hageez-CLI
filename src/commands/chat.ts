import chalk from 'chalk';
import * as readline from 'readline';
import { loadConfig, callLLM, buildSystemPrompt } from '../core';
import { theme, label, separator } from '../ui/theme';
import { scanProject } from '../filesystem';
import { streamLLMResponse, printStreamingHeader } from '../ui/streaming';

export async function runChat(): Promise<void> {
  let config;
  try { config = loadConfig(); } catch {
    console.log(chalk.dim('\n  Run hageez init first.\n'));
    return;
  }

  const project = await scanProject(process.cwd());
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const sys = buildSystemPrompt(
    `Project: ${project.name}, Language: ${project.language ?? 'unknown'}, Framework: ${project.framework ?? 'unknown'}`,
    ''
  );

  console.log('');
  console.log(chalk.bold.hex('#39FF14')('  HageezAI Chat'));
  console.log(chalk.dim('  Type /exit to end session'));
  console.log('');
  console.log(chalk.dim('  Project: ') + chalk.cyan(project.name));
  console.log(chalk.dim('  Model:   ') + chalk.cyan(config.model));
  console.log(separator());
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (q: string): Promise<string> =>
    new Promise(resolve => rl.question(q, resolve));

  while (true) {
    const input = await ask(chalk.hex('#39FF14')('>') + ' ');
    if (!input.trim()) continue;
    if (input.toLowerCase() === '/exit' || input.toLowerCase() === 'exit') {
      console.log('');
      console.log(chalk.dim('  Chat ended.'));
      rl.close();
      break;
    }

    history.push({ role: 'user', content: input });

    try {
      printStreamingHeader();
      process.stdout.write('  ');
      const res = await callLLM(config, [sys, ...history]);
      // Simple streaming simulation - print response char by char
      const lines = res.content.split('\n');
      for (const line of lines) {
        console.log('  ' + chalk.white(line));
      }
      history.push({ role: 'assistant', content: res.content });
      console.log(chalk.dim(`\n  [${res.tokensUsed} tokens]`));
    } catch (err) {
      console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
      rl.close();
      break;
    }
  }
}
