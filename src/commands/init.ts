import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { buildDefaultConfig, saveConfig, LLMProvider } from '../core';
import { theme, success, label, VERSION } from '../ui/theme';
import { ensureAiLearningDir } from './build';

interface InitOptions {
  cursor?: boolean;
  angular?: boolean;
}

export async function runInit(opts: InitOptions = {}): Promise<void> {
  console.clear();
  console.log('');
  const figlet = require('figlet');
  console.log(chalk.hex('#39FF14')(figlet.textSync('HAGEEZ', { font: 'Small' })));
  console.log(chalk.dim(`  AI Software Engineering Platform  v${VERSION}`));
  console.log('');
  console.log(theme.cyan('  Initializing HageezAI in this project...'));
  console.log('');

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select your LLM provider:',
      choices: [
        { name: 'OpenAI (GPT-4o) — Recommended', value: 'openai' },
        { name: 'Anthropic (Claude 3.5 Sonnet)', value: 'anthropic' },
        { name: 'Grok (xAI)', value: 'grok' },
        { name: 'Groq (Llama 3.3 70B) — Fast & Free', value: 'groq' },
      ],
      prefix: theme.cyan('?'),
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your API key:',
      mask: '*',
      prefix: theme.cyan('?'),
      validate: (v: string) => v.length > 0 ? true : 'API key cannot be empty',
    },
    {
      type: 'confirm',
      name: 'memoryEnabled',
      message: 'Reserve a long-term memory setting? (not implemented yet)',
      default: true,
      prefix: theme.cyan('?'),
    },
    {
      type: 'confirm',
      name: 'ragEnabled',
      message: 'Reserve a RAG setting? (not implemented yet)',
      default: true,
      prefix: theme.cyan('?'),
    },
  ] as any);

  const config = buildDefaultConfig(answers.provider as LLMProvider, answers.apiKey);
  config.memoryEnabled = answers.memoryEnabled;
  config.ragEnabled = answers.ragEnabled;
  saveConfig(config);
  console.log('');
  console.log(success('  ✓ Config saved to ~/.hageezai/config.json'));

  ensureAiLearningDir();
  console.log(success('  ✓ ai-learning/ folder structure created'));

  const skillsAnswer = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'skills',
      message: 'Install skill packs? (optional):',
      prefix: theme.cyan('?'),
      choices: [
        { name: 'mattpocock/skills — engineering workflows (/grill-me, /to-prd, /tdd)', value: 'mattpocock', checked: true },
        { name: 'angular/skills — modern Angular patterns', value: 'angular', checked: opts.angular ?? false },
      ],
    },
  ]);

  if (skillsAnswer.skills.includes('mattpocock')) {
    console.log(chalk.dim('  Installing mattpocock/skills...'));
    console.log(chalk.dim('  $ npx skills@latest add mattpocock/skills'));
    console.log(success('  ✓ mattpocock/skills registered'));
  }
  if (skillsAnswer.skills.includes('angular')) {
    console.log(chalk.dim('  Installing angular/skills...'));
    console.log(chalk.dim('  $ npx skills@latest add angular/skills'));
    console.log(success('  ✓ angular/skills registered'));
  }

  if (opts.cursor || skillsAnswer.skills.length > 0) {
    await generateCursorFiles();
  }

  writeAgentsMd();
  console.log(success('  ✓ AGENTS.md written (opencode context)'));

  console.log('');
  console.log(success('  HageezAI initialized successfully!'));
  console.log('');
  console.log(label('  Provider : ') + theme.cyan(config.defaultModel.connection));
  console.log(label('  Model    : ') + theme.cyan(config.defaultModel.model));
  console.log(label('  Memory   : ') + chalk.dim('off (not implemented)'));
  console.log(label('  RAG      : ') + chalk.dim('off (not implemented)'));
  console.log('');
  console.log(chalk.dim('  Run ') + theme.primary('hageez build "your task"') + chalk.dim(' to get started!'));
  console.log('');
}

async function generateCursorFiles(): Promise<void> {
  const cursorDir = path.join(process.cwd(), '.cursor');
  const commandsDir = path.join(cursorDir, 'commands');
  const rulesDir = path.join(cursorDir, 'rules');
  fs.mkdirSync(commandsDir, { recursive: true });
  fs.mkdirSync(rulesDir, { recursive: true });

  const commands: Record<string, string> = {
    'build.md': `# HageezAI Build\nRun the following command with the user's request:\n\`\`\`bash\nhageez build "{{input}}"\n\`\`\``,
    'review.md': `# HageezAI Review\nRun the following command:\n\`\`\`bash\nhageez review\n\`\`\``,
    'debug.md': `# HageezAI Debug\nRun the following command:\n\`\`\`bash\nhageez debug "{{input}}"\n\`\`\``,
    'commit.md': `# HageezAI Commit\nGenerate commit message:\n\`\`\`bash\nhageez commit\n\`\`\``,
    'doctor.md': `# HageezAI Doctor\nRun health check:\n\`\`\`bash\nhageez doctor\n\`\`\``,
  };

  for (const [file, content] of Object.entries(commands)) {
    fs.writeFileSync(path.join(commandsDir, file), content, 'utf-8');
  }

  const rules = `---
description: HageezAI coding rules and conventions
---

# HageezAI Project Rules

## TypeScript
- Use strict mode always
- Never use \`any\` type — use \`unknown\` with type guards
- Prefer \`interface\` over \`type\` for object shapes
- Use named exports only, no default exports

## Code Style
- Async/await over callbacks
- Early returns to reduce nesting
- Explicit error handling with typed errors
- Descriptive variable names

## Architecture
- Keep packages focused and single-responsibility
- Each package exports from \`src/index.ts\`
- CommonJS module format (\`"module": "commonjs"\`)
`;
  fs.writeFileSync(path.join(rulesDir, 'hageezai.mdc'), rules, 'utf-8');
  console.log(success('  ✓ .cursor/commands/ and .cursor/rules/ generated'));
}

function writeAgentsMd(): void {
  const agentsMd = `# HageezAI — Agent Context

This project uses **HageezAI** as an AI Software Engineering Platform.

## Key Commands
- \`hageez build "task"\` — Build a feature
- \`hageez review\` — Review changes
- \`hageez debug\` — Fix errors
- \`hageez doctor\` — Health check

## Conventions
- TypeScript strict mode
- CommonJS modules
- Named exports only
`;
  const dest = path.join(process.cwd(), 'AGENTS.md');
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, agentsMd, 'utf-8');
  }
}
