import chalk from 'chalk';
import * as readline from 'readline';
import { loadConfig, callLLM, buildSystemPrompt } from '../core';
import { theme, success, separator } from '../ui/theme';
import { scanProject } from '../filesystem';

export async function runDocs(target?: string): Promise<void> {
  let config;
  try { config = loadConfig(); } catch {
    console.log(chalk.dim('\n  Run hageez init first.\n'));
    return;
  }

  const t = target ?? await promptTarget('File or module to document (or "all" for full project)');
  if (!t) return;

  console.log('');
  console.log(theme.cyan('  Generating documentation for: ') + chalk.white(t));
  console.log('');

  try {
    const project = await scanProject(process.cwd());
    const sys = buildSystemPrompt(`Project: ${project.name}`, '');
    const res = await callLLM(config, [
      sys,
      {
        role: 'user',
        content: `Generate comprehensive documentation for: ${t}\n\nInclude: overview, functions/exports, parameters, return values, examples.`,
      },
    ]);
    console.log(separator());
    console.log('');
    console.log(chalk.white(res.content));
    console.log('');
    console.log(success('  Documentation generated.'));
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
