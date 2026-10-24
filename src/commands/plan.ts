import chalk from 'chalk';
import * as readline from 'readline';
import { loadConfig, callLLM, buildSystemPrompt } from '../core';
import { theme, success, separator } from '../ui/theme';
import { scanProject } from '../filesystem';

interface PlanOptions {
  prd?: boolean;
  tickets?: boolean;
}

export async function runPlan(task: string | undefined, opts: PlanOptions): Promise<void> {
  let config;
  try { config = loadConfig(); } catch {
    console.log(chalk.dim('\n  Run hageez init first.\n'));
    return;
  }

  const t = task ?? await promptTask();
  if (!t) return;

  console.log('');
  const mode = opts.prd ? 'PRD' : opts.tickets ? 'Tickets' : 'Execution Plan';
  console.log(theme.cyan(`  Creating ${mode} for: `) + chalk.white(`"${t}"`));
  console.log('');

  try {
    const project = await scanProject(process.cwd());
    const sys = buildSystemPrompt(`Project: ${project.name}, Language: ${project.language ?? 'unknown'}`, '');

    let prompt = `Create a detailed execution plan for: ${t}`;
    if (opts.prd) {
      prompt = `Create a full Product Requirements Document (PRD) for: ${t}\n\nInclude: Overview, Goals, User Stories, Technical Requirements, Acceptance Criteria, Timeline.`;
    }
    if (opts.tickets) {
      prompt = `Break down this task into actionable development tickets for: ${t}\n\nFormat each ticket with: Title, Description, Acceptance Criteria, Estimate.`;
    }

    const res = await callLLM(config, [sys, { role: 'user', content: prompt }]);
    console.log(separator());
    console.log('');
    console.log(chalk.white(res.content));
    console.log('');
    console.log(success(`  ${mode} complete.`));
    console.log(chalk.dim(`  Tokens: ${res.tokensUsed}`));
    console.log('');
  } catch (err) {
    console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}

async function promptTask(): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.hex('#39FF14')('> Describe the task or feature: '), a => { rl.close(); resolve(a.trim()); });
  });
}
