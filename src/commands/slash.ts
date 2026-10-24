import chalk from 'chalk';
import { theme } from '../ui/theme';

export interface SlashCommand {
  name: string;
  description: string;
  handler: (args: string) => Promise<void> | void;
}

const commands: SlashCommand[] = [];

export function registerCommand(cmd: SlashCommand): void {
  commands.push(cmd);
}

export function getCommandNames(): string[] {
  return commands.map(c => c.name);
}

export function findCommand(input: string): SlashCommand | undefined {
  const name = input.trim().split(/\s+/)[0]?.toLowerCase();
  return commands.find(c => c.name === name);
}

export function autocompleteCommand(partial: string): string[] {
  return commands
    .filter(c => c.name.startsWith(partial.toLowerCase()))
    .map(c => c.name);
}

export function printHelp(): void {
  console.log('');
  console.log(chalk.bold.hex('#39FF14')('  Available Commands'));
  console.log('');
  for (const cmd of commands) {
    console.log(`  ${chalk.hex('#39FF14')(cmd.name.padEnd(12))} ${chalk.dim(cmd.description)}`);
  }
  console.log('');
  console.log(chalk.dim('  Keyboard Shortcuts'));
  console.log('');
  console.log(`  ${chalk.cyan('Ctrl+C')}     ${chalk.dim('Exit')}`);
  console.log(`  ${chalk.cyan('Ctrl+L')}     ${chalk.dim('Clear screen')}`);
  console.log(`  ${chalk.cyan('Ctrl+R')}     ${chalk.dim('Search history')}`);
  console.log(`  ${chalk.cyan('Tab')}        ${chalk.dim('Autocomplete commands')}`);
  console.log(`  ${chalk.cyan('↑↓')}         ${chalk.dim('Navigate history')}`);
  console.log('');
}

// Built-in commands
export function registerBuiltinCommands(handlers: {
  onBuild?: (args: string) => Promise<void>;
  onReview?: () => Promise<void>;
  onDebug?: (args: string) => Promise<void>;
  onExplain?: (args: string) => Promise<void>;
  onPlan?: (args: string) => Promise<void>;
  onDocs?: (args: string) => Promise<void>;
  onChat?: () => Promise<void>;
  onConfig?: () => void;
  onModel?: () => void;
  onHistory?: () => void;
  onMemory?: () => void;
  onRag?: () => void;
  onConnect?: () => void;
  onTrain?: () => void;
  onDoctor?: () => Promise<void>;
}): void {
  registerCommand({
    name: '/help',
    description: 'Show available commands',
    handler: () => printHelp(),
  });

  if (handlers.onBuild) {
    registerCommand({
      name: '/build',
      description: 'Build a feature',
      handler: (args) => handlers.onBuild!(args),
    });
  }

  if (handlers.onReview) {
    registerCommand({
      name: '/review',
      description: 'Review code changes',
      handler: () => handlers.onReview!(),
    });
  }

  if (handlers.onDebug) {
    registerCommand({
      name: '/debug',
      description: 'Debug and fix errors',
      handler: (args) => handlers.onDebug!(args),
    });
  }

  if (handlers.onExplain) {
    registerCommand({
      name: '/explain',
      description: 'Explain code or concepts',
      handler: (args) => handlers.onExplain!(args),
    });
  }

  if (handlers.onPlan) {
    registerCommand({
      name: '/plan',
      description: 'Create execution plan',
      handler: (args) => handlers.onPlan!(args),
    });
  }

  if (handlers.onDocs) {
    registerCommand({
      name: '/docs',
      description: 'Generate documentation',
      handler: (args) => handlers.onDocs!(args),
    });
  }

  if (handlers.onChat) {
    registerCommand({
      name: '/chat',
      description: 'Start AI chat session',
      handler: () => handlers.onChat!(),
    });
  }

  if (handlers.onDoctor) {
    registerCommand({
      name: '/doctor',
      description: 'Run system health check',
      handler: () => handlers.onDoctor!(),
    });
  }

  registerCommand({
    name: '/config',
    description: 'View/edit configuration',
    handler: () => {
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Configuration'));
      console.log(chalk.dim('  Config: ~/.hageezai/config.json'));
      console.log('');
    },
  });

  registerCommand({
    name: '/skills',
    description: 'List available skills and integrations',
    handler: () => {
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Available Skills'));
      console.log('');
      console.log(`  ${chalk.cyan('mattpocock/skills')}   Engineering workflows`);
      console.log(`    ${chalk.dim('/grill-me')}     Socratic requirement clarification`);
      console.log(`    ${chalk.dim('/to-prd')}       Convert ideas to PRDs`);
      console.log(`    ${chalk.dim('/tdd')}          Test-driven development`);
      console.log('');
      console.log(`  ${chalk.cyan('angular/skills')}     Modern Angular patterns`);
      console.log(`    ${chalk.dim('/component')}    Generate Angular components`);
      console.log(`    ${chalk.dim('/service')}      Generate Angular services`);
      console.log('');
      console.log(chalk.dim('  Install more: npx skills@latest add <source>'));
      console.log('');
    },
  });

  registerCommand({
    name: '/model',
    description: 'Switch LLM model',
    handler: () => {
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Model Selection'));
      console.log(chalk.dim('  Edit ~/.hageezai/config.json to change model'));
      console.log('');
    },
  });

  registerCommand({
    name: '/history',
    description: 'View session history',
    handler: () => {
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Session History'));
      console.log(chalk.dim('  History is stored in ai-learning/session_logs/'));
      console.log('');
    },
  });

  registerCommand({
    name: '/memory',
    description: 'View memory',
    handler: () => {
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Memory'));
      console.log(chalk.dim('  Memory is stored in ai-learning/memory/'));
      console.log('');
    },
  });

  registerCommand({
    name: '/rag',
    description: 'RAG search',
    handler: () => {
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  RAG Search'));
      console.log(chalk.dim('  RAG index stored in ai-learning/embeddings/'));
      console.log('');
    },
  });

  registerCommand({
    name: '/connect',
    description: 'Connect external tools',
    handler: () => {
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  External Connections'));
      console.log(chalk.dim('  Run hageez init --cursor for IDE integration'));
      console.log('');
    },
  });

  registerCommand({
    name: '/train',
    description: 'Train custom patterns',
    handler: () => {
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Training'));
      console.log(chalk.dim('  Training data stored in ai-learning/dataset/'));
      console.log('');
    },
  });
}
