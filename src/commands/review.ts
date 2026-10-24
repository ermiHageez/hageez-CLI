import chalk from 'chalk';
import { loadConfig, callLLM, buildSystemPrompt } from '../core';
import { theme, success, separator } from '../ui/theme';
import { getGitDiff } from '../git';
import { scanProject } from '../filesystem';

interface ReviewOptions {
  staged?: boolean;
}

export async function runReview(opts: ReviewOptions): Promise<void> {
  let config;
  try { config = loadConfig(); } catch {
    console.log(chalk.dim('\n  Run hageez init first.\n'));
    return;
  }

  console.log('');
  console.log(theme.cyan('  Reviewing code changes...'));
  console.log('');

  try {
    const diff = await getGitDiff(opts.staged ?? false);
    if (!diff.trim()) {
      console.log(chalk.dim('  No changes found to review.'));
      return;
    }
    const project = await scanProject(process.cwd());
    const sys = buildSystemPrompt(
      `Project: ${project.name}, Language: ${project.language ?? 'unknown'}`,
      ''
    );
    const res = await callLLM(config, [
      sys,
      {
        role: 'user',
        content: `Review the following code changes and provide feedback on quality, security, and best practices:\n\n\`\`\`diff\n${diff.slice(0, 4000)}\n\`\`\``,
      },
    ]);
    console.log(separator());
    console.log('');
    console.log(chalk.white(res.content));
    console.log('');
    console.log(success('  Review complete.'));
    console.log(chalk.dim(`  Tokens: ${res.tokensUsed}`));
    console.log('');
  } catch (err) {
    console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
