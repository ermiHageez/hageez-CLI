import * as readline from 'readline';
import { HageezConfig } from '../core';
import { UIState, CANONICAL_AGENTS, uiStateReducer, createInitialUIState } from './state';
import { uiEventBus, emitUIEvent } from './events';
import { renderHalfBlockSprite, renderBadge } from './sprites';
import { filterCommands, findCommand, CommandDefinition } from './commands';
import { filterProjectFiles } from './picker';
import { isSmallTalk } from './repl';

export const ESC = '\x1b';
export const ENTER_ALT_SCREEN = `${ESC}[?1049h${ESC}[H${ESC}[?25l`;
export const EXIT_ALT_SCREEN = `${ESC}[?1049l${ESC}[?25h`;
export const RESET = `${ESC}[0m`;

export const COLOR = {
  bg: `${ESC}[48;2;14;17;22m`,
  sidebarBg: `${ESC}[48;2;10;13;18m`,
  panelBg: `${ESC}[48;2;21;26;34m`,
  text: `${ESC}[38;2;216;222;233m`,
  dim: `${ESC}[38;2;139;150;165m`,
  border: `${ESC}[38;2;48;54;61m`,
  green: `${ESC}[38;2;61;220;132m`,
  amber: `${ESC}[38;2;240;180;41m`,
  blue: `${ESC}[38;2;108;182;255m`,
  red: `${ESC}[38;2;255;123;114m`,
  selection: `${ESC}[48;2;31;58;95m`,
};

export interface ScreenCell {
  char: string;
  fg: string;
  bg: string;
}

export type VirtualScreen = ScreenCell[][];

export interface RenderOptions {
  sidebarVisible?: boolean;
  animFrame?: 1 | 2;
  projectBranch?: string;
  projectName?: string;
  slashFilter?: string;
  fileFilter?: string;
}

export function createVirtualScreen(cols: number, rows: number): VirtualScreen {
  const screen: VirtualScreen = [];
  for (let r = 0; r < rows; r++) {
    const row: ScreenCell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({ char: ' ', fg: RESET, bg: COLOR.bg });
    }
    screen.push(row);
  }
  return screen;
}

export function writeCell(
  screen: VirtualScreen,
  r: number,
  c: number,
  char: string,
  fg: string = RESET,
  bg: string = COLOR.bg
): void {
  if (r >= 0 && r < screen.length && c >= 0 && c < screen[0].length) {
    screen[r][c] = { char: char || ' ', fg, bg };
  }
}

export function writeString(
  screen: VirtualScreen,
  r: number,
  startCol: number,
  text: string,
  fg: string = RESET,
  bg: string = COLOR.bg,
  maxLen?: number
): void {
  const str = String(text);
  const limit = maxLen !== undefined ? Math.min(str.length, maxLen) : str.length;
  for (let i = 0; i < limit; i++) {
    writeCell(screen, r, startCol + i, str[i], fg, bg);
  }
}

export function determineBreakpoint(cols: number, rows: number): 'full' | 'compact' | 'narrow' {
  if (cols >= 120 && rows >= 40) return 'full';
  if (cols >= 100) return 'compact';
  return 'narrow';
}

/**
 * Pure rendering function that draws the entire TUI layout into a VirtualScreen buffer.
 */
export function renderVirtualScreen(
  state: UIState,
  cols: number,
  rows: number,
  options: RenderOptions = {}
): VirtualScreen {
  const screen = createVirtualScreen(cols, rows);
  const breakpoint = determineBreakpoint(cols, rows);
  const sidebarVisible = options.sidebarVisible !== false && breakpoint !== 'narrow';
  const sidebarWidth = sidebarVisible ? (breakpoint === 'compact' ? 32 : 40) : 0;
  const feedWidth = cols - sidebarWidth;
  const animFrame = options.animFrame || 1;
  const branch = options.projectBranch || 'Trustworthy-foundation';
  const project = options.projectName || 'hageezai-cli';

  // 1. Header (Row 0)
  writeString(screen, 0, 0, ' '.repeat(cols), COLOR.text, COLOR.sidebarBg);
  writeString(screen, 0, 2, state.sidebar.runId || 'idle', COLOR.blue, COLOR.sidebarBg);
  writeString(screen, 0, 16, state.sidebar.title || 'hageez', COLOR.text, COLOR.sidebarBg);
  const rightHeader = `${project} (branch: ${branch})`;
  if (cols - rightHeader.length - 2 > 35) {
    writeString(screen, 0, cols - rightHeader.length - 2, rightHeader, COLOR.amber, COLOR.sidebarBg);
  }

  // Header separator
  for (let c = 0; c < cols; c++) {
    writeCell(screen, 1, c, '─', COLOR.border, COLOR.bg);
  }

  // 2. Feed Area (Rows 2 to rows - 5)
  const feedTop = 2;
  const feedBottom = rows - 5;
  const workingAgent = state.sidebar.agents.find((a) => a.status === 'working');
  const availableRows = Math.max(1, (feedBottom - feedTop) - (workingAgent ? 1 : 0));

  interface FeedLine {
    bullet: string;
    bulletColor: string;
    text: string;
    textColor: string;
  }

  const allLines: FeedLine[] = [];
  for (const block of state.feed.blocks) {
    if (block.kind === 'user') {
      allLines.push({ bullet: '▌', bulletColor: COLOR.amber, text: `USER TASK: ${block.content}`, textColor: COLOR.amber });
      allLines.push({ bullet: ' ', bulletColor: COLOR.bg, text: '', textColor: COLOR.bg });
    } else if (block.kind === 'agent') {
      allLines.push({ bullet: '✔', bulletColor: COLOR.green, text: `${(block.agent || 'agent').padEnd(14)} ${block.content}`, textColor: COLOR.text });
    } else if (block.kind === 'command' || block.kind === 'system') {
      const sublines = String(block.content || '').split('\n');
      for (const line of sublines) {
        allLines.push({ bullet: ' ', bulletColor: COLOR.dim, text: line, textColor: COLOR.text });
      }
    } else if (block.kind === 'diff') {
      const sublines = String(block.content || '').split('\n');
      for (const line of sublines) {
        allLines.push({ bullet: '│', bulletColor: COLOR.border, text: line, textColor: COLOR.dim });
      }
    } else {
      const sublines = String(block.content || '').split('\n');
      for (const line of sublines) {
        allLines.push({ bullet: '●', bulletColor: COLOR.dim, text: line, textColor: COLOR.dim });
      }
    }
  }

  const visibleLines = allLines.length > availableRows ? allLines.slice(-availableRows) : allLines;
  let feedRow = feedTop;
  for (const line of visibleLines) {
    if (feedRow >= feedBottom) break;
    writeCell(screen, feedRow, 2, line.bullet, line.bulletColor, COLOR.bg);
    writeString(screen, feedRow, 4, line.text, line.textColor, COLOR.bg, feedWidth - 6);
    feedRow++;
  }

  // Working agent indicator in feed
  if (workingAgent && feedRow < feedBottom) {
    writeCell(screen, feedRow, 2, '▶', COLOR.blue, COLOR.bg);
    writeString(screen, feedRow, 4, `${workingAgent.agent.padEnd(14)} working... (${workingAgent.elapsedSeconds}s)`, COLOR.blue, COLOR.bg, feedWidth - 6);
  }

  // 3. Sidebar (Right panel)
  if (sidebarVisible && sidebarWidth > 0) {
    const sCol = feedWidth;

    // Vertical border
    for (let r = 1; r < rows - 1; r++) {
      writeCell(screen, r, sCol - 1, '│', COLOR.border, COLOR.sidebarBg);
    }
    // Background fill
    for (let r = 2; r < rows - 1; r++) {
      for (let c = sCol; c < cols; c++) {
        writeCell(screen, r, c, ' ', COLOR.text, COLOR.sidebarBg);
      }
    }

    // Logo & Session
    writeString(screen, 2, sCol + 2, '🤖 HAGEEZ AI  v1.0.0', COLOR.green, COLOR.sidebarBg);
    writeString(screen, 3, sCol + 2, `Session: ${state.sidebar.title}`.slice(0, sidebarWidth - 4), COLOR.dim, COLOR.sidebarBg);

    // Context & Cost
    const costText = `$${state.sidebar.estimatedCost.toFixed(3)}`;
    writeString(screen, 4, sCol + 2, `Tokens: ${state.sidebar.tokens} (${state.sidebar.tokenPercent}%) • ${costText}`, COLOR.text, COLOR.sidebarBg, sidebarWidth - 4);
    writeString(screen, 5, sCol + 2, '─'.repeat(sidebarWidth - 4), COLOR.border, COLOR.sidebarBg);
    writeString(screen, 6, sCol + 2, `Agents: ${state.sidebar.agentsDoneCount} of ${state.sidebar.totalAgents} done`, COLOR.green, COLOR.sidebarBg);

    // Agent Rows
    let agentRowIdx = 8;
    for (const ag of state.sidebar.agents) {
      if (agentRowIdx >= rows - 4) break;
      const isWorking = ag.status === 'working';
      const isDone = ag.status === 'done';
      const statusText = isDone ? `✔ ${ag.formattedTime || ag.elapsedSeconds + 's'}` :
                         isWorking ? `● ${ag.elapsedSeconds}s` :
                         ag.status === 'skipped' ? 'skipped' : 'wait';
      const statusColor = isDone ? COLOR.green : isWorking ? COLOR.blue : COLOR.dim;
      const badge = renderBadge(ag.agent, ag.status === 'waiting');
      const badgeColor = isDone ? COLOR.green : isWorking ? COLOR.blue : COLOR.dim;
      const namePart = `${ag.agent.slice(0, 14).padEnd(14)} ${ag.model ? ag.model.slice(0, 10) : ''}`;

      writeString(screen, agentRowIdx, sCol + 2, badge, badgeColor, COLOR.sidebarBg);
      writeString(screen, agentRowIdx, sCol + 2 + badge.length + 1, namePart, isWorking ? COLOR.text : ag.status === 'waiting' ? COLOR.dim : COLOR.text, COLOR.sidebarBg, sidebarWidth - 12 - badge.length - 1);
      writeString(screen, agentRowIdx, sCol + sidebarWidth - 8, statusText.padStart(7), statusColor, COLOR.sidebarBg);

      agentRowIdx += breakpoint === 'full' ? 2 : 1;
    }

    // Bottom block
    writeString(screen, rows - 3, sCol + 2, `dir: ${project}`.slice(0, sidebarWidth - 4), COLOR.dim, COLOR.sidebarBg);
    writeString(screen, rows - 2, sCol + 2, 'node >=22.12.0 • CommonJS', COLOR.dim, COLOR.sidebarBg);
  }

  // 4. Input Area (Rows rows - 4 to rows - 2)
  for (let c = 0; c < feedWidth; c++) {
    writeCell(screen, rows - 4, c, '─', COLOR.border, COLOR.bg);
  }
  writeCell(screen, rows - 3, 2, '>', COLOR.green, COLOR.bg);
  writeString(screen, rows - 3, 4, state.input.buffer, COLOR.text, COLOR.bg, feedWidth - 6);
  writeCell(screen, rows - 3, 4 + state.input.buffer.length, '▋', COLOR.green, COLOR.bg);

  const modeLine = `${state.input.mode === 'build' ? 'Build mode' : 'Plan mode'} • ${state.input.model || 'default'} • HageezAI`;
  writeString(screen, rows - 2, 4, modeLine, COLOR.dim, COLOR.bg, feedWidth - 6);

  // 5. Slash Menu or File Picker Overlay
  if (options.slashFilter !== undefined) {
    const matches = filterCommands(options.slashFilter).slice(0, 6);
    const menuTop = Math.max(2, rows - 4 - matches.length - 1);
    for (let i = 0; i < matches.length; i++) {
      const cmd = matches[i];
      const isSelected = i === 0;
      const menuRow = menuTop + i;
      const bgCol = isSelected ? COLOR.selection : COLOR.panelBg;
      writeString(screen, menuRow, 4, ` ${cmd.name.padEnd(10)} ${cmd.description} `.slice(0, 50), isSelected ? COLOR.green : COLOR.text, bgCol);
    }
  }

  // 6. Diff Modal Overlay
  if (state.approval.active && state.approval.file) {
    const modalTop = 4;
    const modalHeight = Math.min(16, rows - 10);
    const modalWidth = Math.min(70, feedWidth - 8);

    // Modal frame
    for (let r = modalTop; r < modalTop + modalHeight; r++) {
      for (let c = 4; c < 4 + modalWidth; c++) {
        writeCell(screen, r, c, ' ', COLOR.text, COLOR.panelBg);
      }
    }
    writeString(screen, modalTop, 6, `⚖️ DIFF APPROVAL GATE: ${state.approval.file}`, COLOR.amber, COLOR.panelBg);
    writeString(screen, modalTop + 1, 6, '─'.repeat(modalWidth - 4), COLOR.border, COLOR.panelBg);

    const diffLines = (state.approval.diff || '').split('\n').slice(0, modalHeight - 4);
    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];
      const fgCol = line.startsWith('+') ? COLOR.green : line.startsWith('-') ? COLOR.red : COLOR.dim;
      writeString(screen, modalTop + 2 + i, 6, line.slice(0, modalWidth - 6), fgCol, COLOR.panelBg);
    }

    writeString(screen, modalTop + modalHeight - 1, 6, 'Approve? [y] Yes  [n] No  [a] All', COLOR.amber, COLOR.panelBg);
  }

  // 7. Footer (Row rows - 1)
  writeString(screen, rows - 1, 0, ' '.repeat(cols), COLOR.dim, COLOR.sidebarBg);
  writeString(screen, rows - 1, 2, 'esc interrupt  tab build/plan  @ files', COLOR.dim, COLOR.sidebarBg);
  const rightFooter = `Tokens: ${state.sidebar.tokens} (${state.sidebar.tokenPercent}%)  ctrl+p commands`;
  if (cols - rightFooter.length - 2 > 35) {
    writeString(screen, rows - 1, cols - rightFooter.length - 2, rightFooter, COLOR.dim, COLOR.sidebarBg);
  }

  return screen;
}

/**
 * Converts a VirtualScreen to a plain text string (strip color codes for snapshot tests).
 */
export function virtualScreenToPlainText(screen: VirtualScreen): string {
  return screen.map((row) => row.map((cell) => cell.char).join('')).join('\n');
}

/**
 * Flushes diff between previous and current virtual screen to a string of ANSI escapes.
 */
export function flushVirtualScreenDiff(prev: VirtualScreen | null, curr: VirtualScreen): string {
  let out = '';
  let lastFg = '';
  let lastBg = '';

  for (let r = 0; r < curr.length; r++) {
    for (let c = 0; c < curr[0].length; c++) {
      const cell = curr[r][c];
      const prevCell = prev && prev[r] ? prev[r][c] : null;

      if (!prevCell || prevCell.char !== cell.char || prevCell.fg !== cell.fg || prevCell.bg !== cell.bg) {
        out += `${ESC}[${r + 1};${c + 1}H`;
        if (cell.fg !== lastFg) {
          out += cell.fg;
          lastFg = cell.fg;
        }
        if (cell.bg !== lastBg) {
          out += cell.bg;
          lastBg = cell.bg;
        }
        out += cell.char;
      }
    }
  }

  if (out.length > 0) out += RESET;
  return out;
}

export function enterAlternateScreen(): void {
  process.stdout.write(ENTER_ALT_SCREEN);
}

export function exitAlternateScreen(): void {
  process.stdout.write(EXIT_ALT_SCREEN);
}

/**
 * Starts the live full-screen terminal interface.
 */
export async function startFullScreenTui(config?: HageezConfig): Promise<void> {
  let state = createInitialUIState();
  let prevScreen: VirtualScreen | null = null;
  let sidebarVisible = true;
  let animFrame: 1 | 2 = 1;

  enterAlternateScreen();

  const cleanup = () => {
    exitAlternateScreen();
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch {}
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error('Fatal TUI error:', err);
    process.exit(1);
  });

  const redraw = () => {
    const cols = process.stdout.columns || 120;
    const rows = process.stdout.rows || 40;
    const currScreen = renderVirtualScreen(state, cols, rows, {
      sidebarVisible,
      animFrame,
      slashFilter: state.input.buffer.startsWith('/') ? state.input.buffer : undefined,
    });
    const diff = flushVirtualScreenDiff(prevScreen, currScreen);
    process.stdout.write(diff);
    prevScreen = currScreen;
  };

  process.stdout.on('resize', () => {
    prevScreen = null;
    redraw();
  });

  // 4 FPS animation timer
  const animInterval = setInterval(() => {
    animFrame = animFrame === 1 ? 2 : 1;
    const working = state.sidebar.agents.find((a) => a.status === 'working');
    if (working) redraw();
  }, 250);

  // Hook event bus to UI state
  uiEventBus.on('run:start', (payload) => { state = uiStateReducer(state, { type: 'run:start', payload }); redraw(); });
  uiEventBus.on('agent:start', (payload) => { state = uiStateReducer(state, { type: 'agent:start', payload }); redraw(); });
  uiEventBus.on('agent:done', (payload) => { state = uiStateReducer(state, { type: 'agent:done', payload }); redraw(); });
  uiEventBus.on('agent:failed', (payload) => { state = uiStateReducer(state, { type: 'agent:failed', payload }); redraw(); });
  uiEventBus.on('agent:skipped', (payload) => { state = uiStateReducer(state, { type: 'agent:skipped', payload }); redraw(); });
  uiEventBus.on('usage', (payload) => { state = uiStateReducer(state, { type: 'usage', payload }); redraw(); });
  uiEventBus.on('feed:block', (payload) => { state = uiStateReducer(state, { type: 'feed:block', payload }); redraw(); });
  uiEventBus.on('approval:request', (payload) => { state = uiStateReducer(state, { type: 'approval:request', payload }); redraw(); });

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const output = (line: string) => {
      state = uiStateReducer(state, {
        type: 'feed:block',
        payload: { kind: 'command', content: line, timestamp: Date.now() },
      });
      redraw();
    };

    const handleInput = async (rawText: string): Promise<void> => {
      const text = rawText.trim();
      if (!text) return;

      if (text.startsWith('/')) {
        const parts = text.split(/\s+/);
        let cmdName = parts[0];
        const args = parts.slice(1);

        if (cmdName === '/exit' || cmdName === '/quit') {
          cleanup();
          process.exit(0);
        }

        let cmd = findCommand(cmdName);
        if (!cmd) {
          const matches = filterCommands(cmdName);
          if (matches.length > 0) {
            cmd = matches[0];
            cmdName = cmd.name;
          }
        }

        if (cmd && cmd.run) {
          try {
            await cmd.run(args, {
              config,
              output,
              setMode: (m) => {
                state.input.mode = m;
                redraw();
              },
            });
          } catch (err) {
            output(`Error in ${cmdName}: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else if (cmd) {
          output(`Command ${cmdName} has no action handler.`);
        } else {
          output(`Unknown command: ${cmdName}. Type /help for available commands.`);
        }
        return;
      }

      if (isSmallTalk(text)) {
        output('Notice: Conversational query routed to Chat. Build requires an engineering task.');
        try {
          const { callLLM, loadConfig } = await import('../core');
          const cfg = config || loadConfig();
          const res = await callLLM(cfg, [
            { role: 'system', content: 'You are HageezAI, a concise and helpful AI software engineering assistant.' },
            { role: 'user', content: text },
          ]);
          for (const l of res.content.split('\n')) {
            output(l);
          }
        } catch (err) {
          output(`Chat error: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }

      if (state.input.mode === 'build') {
        output(`Starting build: "${text}"`);
        try {
          const { runBuild } = await import('../commands/build');
          await runBuild(text, { silent: true });
        } catch (err) {
          output(`Build error: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        output(`Starting plan: "${text}"`);
        try {
          const { runPlan } = await import('../commands/plan');
          const planOutput = await runPlan(text, { silent: true });
          if (planOutput) {
            for (const l of planOutput.split('\n')) {
              output(l);
            }
          }
        } catch (err) {
          output(`Plan error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    };

    process.stdin.on('keypress', (str, key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }
      if (key.ctrl && key.name === 'b') {
        sidebarVisible = !sidebarVisible;
        redraw();
        return;
      }
      if (key.name === 'tab') {
        if (state.input.buffer.startsWith('/')) {
          const matches = filterCommands(state.input.buffer);
          if (matches.length > 0) {
            state.input.buffer = matches[0].name + ' ';
            redraw();
            return;
          }
        }
        state.input.mode = state.input.mode === 'build' ? 'plan' : 'build';
        redraw();
        return;
      }
      if (key.name === 'escape') {
        if (state.input.buffer.startsWith('/')) {
          state.input.buffer = '';
        }
        redraw();
        return;
      }
      if (key.name === 'backspace') {
        state.input.buffer = state.input.buffer.slice(0, -1);
        redraw();
        return;
      }
      if (key.name === 'return') {
        let text = state.input.buffer.trim();
        state.input.buffer = '';
        if (!text) {
          redraw();
          return;
        }

        if (text.startsWith('/') && !findCommand(text)) {
          const matches = filterCommands(text);
          if (matches.length > 0) {
            text = matches[0].name;
          }
        }

        state = uiStateReducer(state, {
          type: 'feed:block',
          payload: { kind: 'user', content: text, timestamp: Date.now() },
        });
        redraw();
        handleInput(text);
        return;
      }
      if (str && !key.ctrl && !key.meta && str.length === 1) {
        state.input.buffer += str;
        redraw();
      }
    });
  }

  redraw();
}
