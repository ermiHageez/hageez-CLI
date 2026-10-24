import chalk from 'chalk';
import * as readline from 'readline';
import { loadConfig, callLLM, buildSystemPrompt } from '../core';
import { theme, success, separator } from '../ui/theme';
import { scanProject } from '../filesystem';

export async function runDebug(errorMsg?: string): Promise<void> {
  let config;
  try { config = loadConfig(); } catch {
    console.log(chalk.dim('\n  Run hageez init first.\n'));
    return;
  }

  const err = errorMsg ?? await promptTarget('Paste or describe the error');
  if (!err) return;

  console.log('');
  console.log(theme.cyan('  Debugging: ') + chalk.white(`"${err.slice(0, 60)}..."`));
  console.log('');

  try {
    const project = await scanProject(process.cwd());
    const sys = buildSystemPrompt(
      `Project: ${project.name}, Language: ${project.language ?? 'unknown'}`,
      ''
    );
    const res = await callLLM(config, [
      sys,
      {
        role: 'user',
        content: `Debug and fix this error in our project:\n\n${err}`,
      },
    ]);
    console.log(separator());
    console.log('');
    console.log(chalk.white(res.content));
    console.log('');
    console.log(success('  Debug analysis complete.'));
    console.log('');
  } catch (e) {
    console.log(theme.red(`  Error: ${e instanceof Error ? e.message : String(e)}`));
  }
}

async function promptTarget(q: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.hex('#39FF14')(`> ${q}: `), a => { rl.close(); resolve(a.trim()); });
  });
}
