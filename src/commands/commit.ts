import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig, callLLM, buildSystemPrompt } from '../core';
import { theme, success, separator } from '../ui/theme';
import { getGitDiff, gitCommit } from '../git';

interface CommitOptions {
  push?: boolean;
}

export async function runCommit(opts: CommitOptions): Promise<void> {
  let config;
  try { config = loadConfig(); } catch {
    console.log(chalk.dim('\n  Run hageez init first.\n'));
    return;
  }

  console.log('');
  console.log(theme.cyan('  Generating commit message...'));

  try {
    const diff = await getGitDiff(true);
    if (!diff.trim()) {
      console.log(chalk.dim('  No staged changes found. Stage files with `git add` first.'));
      return;
    }

    const sys = buildSystemPrompt('', '');
    const res = await callLLM(config, [
      sys,
      {
        role: 'user',
        content: `Generate a conventional commit message for these changes:\n\n\`\`\`diff\n${diff.slice(0, 3000)}\n\`\`\`\n\nFormat: <type>(<scope>): <description>\n\nReturn only the commit message, no explanation.`,
      },
    ]);

    const message = res.content.trim().split('\n')[0] ?? 'chore: update code';
    console.log('');
    console.log(separator());
    console.log('');
    console.log(chalk.white(`  ${message}`));
    console.log('');

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Use this commit message?',
      default: true,
      prefix: theme.cyan('?'),
    }] as any);

    if (confirm) {
      await gitCommit(message, opts.push ?? false);
      console.log(success('  ✓ Committed successfully!'));
      if (opts.push) console.log(success('  ✓ Pushed to remote.'));
    }
    console.log('');
  } catch (err) {
    console.log(theme.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
  }
}
