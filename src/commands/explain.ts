import chalk from 'chalk';
import * as readline from 'readline';
import { loadConfig, callLLM, buildSystemPrompt } from '../core';
import { theme, label, success, separator } from '../ui/theme';
import { scanProject } from '../filesystem';

export async function runExplain(target?: string): Promise<void> {
  let config;
  try { config = loadConfig(); } catch {
    console.log(chalk.dim('\n  Run hageez init first.\n'));
    return;
  }

  const t = target ?? await promptTarget('What do you want explained? (file, function, concept)');
  if (!t) return;

  const project = await scanProject(process.cwd());
  console.log('');
  console.log(theme.cyan('  Explaining: ') + chalk.white(`"${t}"`));
  console.log('');

  try {
    const sys = buildSystemPrompt(
      `Project: ${project.name}, Language: ${project.language ?? 'unknown'}`,
      ''
    );
    const res = await callLLM(config, [
      sys,
      { role: 'user', content: `Explain this in the context of our project: ${t}` },
    ]);
    console.log(separator());
    console.log('');
    console.log(chalk.white(res.content));
    console.log('');
    console.log(chalk.dim(`  Tokens: ${res.tokensUsed}  Time: ${Math.round(res.durationMs / 1000)}s`));
    console.log('');
  } catch (err) {
    console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function promptTarget(q: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.hex('#39FF14')(`> ${q}: `), a => { rl.close(); resolve(a.trim()); });
  });
}
