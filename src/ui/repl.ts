import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { theme } from './theme';
import { runBuild } from '../commands/build';
import { runExplain } from '../commands/explain';
import { runReview } from '../commands/review';
import { runDebug } from '../commands/debug';
import { runPlan } from '../commands/plan';
import { runDocs } from '../commands/docs';
import { runChat } from '../commands/chat';
import { runDoctor } from '../commands/doctor';

const HISTORY_FILE = path.join(process.cwd(), 'ai-learning', 'session_logs', 'repl-history.json');

type Mode = 'plan' | 'build';

const COMMANDS = [
  { name: '/help', description: 'Show available commands' },
  { name: '/build', description: 'Build a feature' },
  { name: '/review', description: 'Review code changes' },
  { name: '/debug', description: 'Debug and fix errors' },
  { name: '/explain', description: 'Explain code or concepts' },
  { name: '/plan', description: 'Create execution plan' },
  { name: '/docs', description: 'Generate documentation' },
  { name: '/chat', description: 'Start AI chat session' },
  { name: '/doctor', description: 'Run system health check' },
  { name: '/skills', description: 'List available skills' },
  { name: '/config', description: 'View configuration' },
  { name: '/model', description: 'Switch LLM model' },
  { name: '/history', description: 'View session history' },
  { name: '/memory', description: 'View memory' },
  { name: '/rag', description: 'RAG search' },
  { name: '/connect', description: 'Connect external tools' },
  { name: '/train', description: 'Train custom patterns' },
];

function loadHistory(): string[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveHistory(history: string[]): void {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-100), null, 2));
  } catch {}
}

function scanDir(dir: string, maxDepth = 2, depth = 0, prefix = ''): string[] {
  const results: string[] = [];
  if (depth > maxDepth) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      const rel = prefix ? prefix + '/' + e.name : e.name;
      if (e.isDirectory()) {
        results.push(rel + '/');
        results.push(...scanDir(path.join(dir, e.name), maxDepth, depth + 1, rel));
      } else {
        results.push(rel);
      }
    }
  } catch {}
  return results;
}

function showCommandMenu(filter: string): void {
  const filtered = filter
    ? COMMANDS.filter(c => c.name.includes(filter) || c.description.toLowerCase().includes(filter.toLowerCase()))
    : COMMANDS;

  console.log('');
  console.log(chalk.bold.hex('#39FF14')('  Commands'));
  console.log('');
  for (const c of filtered) {
    console.log(`  ${chalk.hex('#39FF14')(c.name.padEnd(14))} ${chalk.dim(c.description)}`);
  }
  if (filtered.length === 0) console.log(chalk.dim('  No matching commands'));
  console.log('');
}

function showFileBrowser(filter: string, root: string): void {
  const files = scanDir(root);
  const filtered = filter
    ? files.filter(f => f.toLowerCase().includes(filter.toLowerCase()))
    : files;

  console.log('');
  console.log(chalk.bold.hex('#39FF14')('  Files'));
  console.log('');
  for (const f of filtered.slice(0, 20)) {
    const isDir = f.endsWith('/');
    const icon = isDir ? chalk.cyan('📁 ') : '  ';
    console.log(`  ${icon}${chalk.white(f)}`);
  }
  if (filtered.length === 0) console.log(chalk.dim('  No matching files'));
  if (filtered.length > 20) console.log(chalk.dim(`  ... and ${filtered.length - 20} more`));
  console.log('');
}

function showModeLine(mode: Mode): void {
  const modeText = mode === 'build'
    ? chalk.hex('#39FF14')('● build') + chalk.dim(' ○ plan')
    : chalk.dim('○ build') + ' ' + chalk.cyan('● plan');
  console.log(chalk.dim('  mode: ') + modeText);
}

function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

function readLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    let buffer = '';
    let pos = 0;

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    process.stdout.write(prompt);

    const onData = (key: string) => {
      // Enter
      if (key === '\n' || key === '\r') {
        cleanup();
        process.stdout.write('\n');
        resolve(buffer);
        return;
      }

      // Backspace
      if (key === '\x7f' || key === '\b') {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          clearLine();
          process.stdout.write(prompt + buffer);
        }
        return;
      }

      // Ctrl+C
      if (key === '\x03') {
        cleanup();
        console.log(chalk.dim('\n  Goodbye!\n'));
        process.exit(0);
      }

      // Ctrl+L clear
      if (key === '\x0c') {
        console.clear();
        process.stdout.write(prompt + buffer);
        return;
      }

      // Tab
      if (key === '\t') {
        cleanup();
        resolve('__TAB__');
        return;
      }

      // Escape sequences (arrows, etc)
      if (key === '\x1b') {
        // Wait for more bytes
        return;
      }

      // Arrow up
      if (key === '\x1b[A') {
        cleanup();
        resolve('__UP__');
        return;
      }

      // Arrow down
      if (key === '\x1b[B') {
        cleanup();
        resolve('__DOWN__');
        return;
      }

      // Ignore other escape sequences
      if (key.startsWith('\x1b[')) {
        return;
      }

      // Normal character
      buffer += key;
      process.stdout.write(key);
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode?.(wasRaw ?? false);
      stdin.pause();
    };

    stdin.on('data', onData);
  });
}

async function executeCommand(cmd: string, args: string): Promise<void> {
  switch (cmd) {
    case '/help':
      showCommandMenu('');
      break;
    case '/build':
      await runBuild(args || undefined, {});
      break;
    case '/review':
      await runReview({});
      break;
    case '/debug':
      await runDebug(args || undefined);
      break;
    case '/explain':
      await runExplain(args || undefined);
      break;
    case '/plan':
      await runPlan(args || undefined, {});
      break;
    case '/docs':
      await runDocs(args || undefined);
      break;
    case '/chat':
      await runChat();
      break;
    case '/doctor':
      await runDoctor();
      break;
    case '/skills':
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Available Skills'));
      console.log('');
      console.log(`  ${chalk.cyan('mattpocock/skills')}   Engineering workflows`);
      console.log(`    ${chalk.dim('/grill-me')}     Socratic requirement clarification`);
      console.log(`    ${chalk.dim('/to-prd')}       Convert ideas to PRDs`);
      console.log(`    ${chalk.dim('/tdd')}          Test-driven development`);
      console.log('');
      console.log(`  ${chalk.cyan('angular/skills')}     Modern Angular patterns`);
      console.log('');
      console.log(chalk.dim('  Install: npx skills@latest add <source>'));
      console.log('');
      break;
    case '/config':
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Configuration'));
      console.log(chalk.dim('  Config: ~/.hageezai/config.json'));
      console.log('');
      break;
    case '/model':
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Model Selection'));
      console.log(chalk.dim('  Edit ~/.hageezai/config.json to change model'));
      console.log('');
      break;
    case '/history':
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Session History'));
      console.log(chalk.dim('  History is stored in ai-learning/session_logs/'));
      console.log('');
      break;
    case '/memory':
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Memory'));
      console.log(chalk.dim('  Memory is stored in ai-learning/memory/'));
      console.log('');
      break;
    case '/rag':
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  RAG Search'));
      console.log(chalk.dim('  RAG index stored in ai-learning/embeddings/'));
      console.log('');
      break;
    case '/connect':
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  External Connections'));
      console.log(chalk.dim('  Run hageez init --cursor for IDE integration'));
      console.log('');
      break;
    case '/train':
      console.log('');
      console.log(chalk.bold.hex('#39FF14')('  Training'));
      console.log(chalk.dim('  Training data stored in ai-learning/dataset/'));
      console.log('');
      break;
    default:
      console.log(chalk.dim(`  Unknown command: ${cmd}`));
      console.log(chalk.dim('  Type / for available commands.'));
  }
}

export function isSmallTalk(input: string): boolean {
  const clean = input.trim().toLowerCase();
  const greetings = new Set([
    'hi',
    'hello',
    'hey',
    'yo',
    'sup',
    'howdy',
    'how are you',
    'who are you',
    'what can you do',
    'good morning',
    'good evening',
    'good afternoon',
    'help',
  ]);
  if (greetings.has(clean)) return true;
  if (/^(hi|hello|hey)\b/i.test(clean) && clean.length <= 15) return true;
  if (/(?:say|answer to my|reply to my)\s+(?:hi|hello|hey)/i.test(clean)) return true;
  if (/^(i need to test|just testing|test test|can you answer|give me (?:an|the) answer)/i.test(clean) && !/(build|create|add|fix|refactor|implement|code|write)\b/i.test(clean)) {
    return true;
  }
  if (clean.endsWith('?') && !/(build|create|add|fix|refactor|update|delete|implement|write|code|make)\b/i.test(clean)) {
    return true;
  }
  return false;
}

export async function startRepl(config: any): Promise<void> {
  const commandHistory = loadHistory();
  let historyIndex = -1;
  let currentMode: Mode = 'build';

  while (true) {
    showModeLine(currentMode);

    const input = await readLine(chalk.hex('#39FF14')('> '));

    // Tab — switch mode
    if (input === '__TAB__') {
      currentMode = currentMode === 'build' ? 'plan' : 'build';
      console.log(chalk.dim(`  Switched to ${currentMode} mode`));
      console.log('');
      continue;
    }

    // History navigation
    if (input === '__UP__') {
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        clearLine();
        const hist = commandHistory[commandHistory.length - 1 - historyIndex];
        process.stdout.write(chalk.hex('#39FF14')('> ') + hist);
        // Re-enter input loop with this value
        const next = await readLine('');
        // For simplicity, just use the history value
        if (next === '' || next === '__UP__' || next === '__DOWN__' || next === '__TAB__') {
          // Continue with history value
        }
      }
      continue;
    }

    if (input === '__DOWN__') {
      if (historyIndex > 0) {
        historyIndex--;
        clearLine();
        const hist = commandHistory[commandHistory.length - 1 - historyIndex];
        process.stdout.write(chalk.hex('#39FF14')('> ') + hist);
      } else {
        historyIndex = -1;
        clearLine();
        process.stdout.write(chalk.hex('#39FF14')('> '));
      }
      continue;
    }

    const command = input.trim();
    if (!command) continue;

    // Exit
    if (command === 'exit' || command === 'quit' || command === '/exit') {
      console.log(chalk.dim('\n  Goodbye!\n'));
      break;
    }

    // / — show command menu
    if (command === '/') {
      showCommandMenu('');
      const selected = await readLine(chalk.hex('#39FF14')('▸ '));
      const sel = selected.trim();
      if (sel.startsWith('/')) {
        const cmdName = sel.split(/\s+/)[0];
        const args = sel.slice(cmdName.length).trim();
        await executeCommand(cmdName, args);
      } else {
        const match = COMMANDS.find(c => c.name.includes(sel));
        if (match) {
          await executeCommand(match.name, '');
        } else {
          console.log(chalk.dim('  No matching command'));
        }
      }
      console.log('');
      continue;
    }

    // /command with args
    if (command.startsWith('/')) {
      const parts = command.split(/\s+/);
      const cmdName = parts[0];
      const args = parts.slice(1).join(' ');
      await executeCommand(cmdName, args);
      console.log('');
      continue;
    }

    // @ — show file browser
    if (command === '@') {
      showFileBrowser('', process.cwd());
      const selected = await readLine(chalk.hex('#39FF14')('▸ '));
      const filePath = selected.trim();
      if (filePath) {
        const task = await readLine(chalk.hex('#39FF14')('> ') + chalk.dim('What to do? '));
        if (task.trim()) {
          console.log('');
          const fullTask = `${filePath} ${task.trim()}`;
          try {
            if (currentMode === 'build') {
              await runBuild(fullTask, {});
            } else {
              await runPlan(fullTask, {});
            }
          } catch (e) {
            console.log(theme.red(`  Error: ${e instanceof Error ? e.message : String(e)}`));
          }
        }
      }
      console.log('');
      continue;
    }

    // @query — filter files
    if (command.startsWith('@')) {
      const query = command.slice(1).trim();
      showFileBrowser(query, process.cwd());
      const selected = await readLine(chalk.hex('#39FF14')('▸ '));
      if (selected.trim()) {
        const task = await readLine(chalk.hex('#39FF14')('> ') + chalk.dim('What to do? '));
        if (task.trim()) {
          console.log('');
          const fullTask = `${selected.trim()} ${task.trim()}`;
          try {
            if (currentMode === 'build') {
              await runBuild(fullTask, {});
            } else {
              await runPlan(fullTask, {});
            }
          } catch (e) {
            console.log(theme.red(`  Error: ${e instanceof Error ? e.message : String(e)}`));
          }
        }
      }
      console.log('');
      continue;
    }

    // Save to history
    commandHistory.push(command);
    saveHistory(commandHistory);
    historyIndex = -1;

    // Small talk and plain questions go to Chat, not Build
    if (isSmallTalk(command)) {
      console.log('');
      console.log(chalk.dim('  Notice: Conversational query routed to Chat. Build requires an engineering task.'));
      console.log('');
      await runChat();
      console.log('');
      continue;
    }

    // Execute as build or plan task
    console.log('');
    try {
      if (currentMode === 'build') {
        await runBuild(command, {});
      } else {
        await runPlan(command, {});
      }
    } catch (e) {
      console.log(theme.red(`  Error: ${e instanceof Error ? e.message : String(e)}`));
    }
    console.log('');
  }
}
