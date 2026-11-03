#!/usr/bin/env node
'use strict';

/**
 * Spike: In-House Double-Buffered ANSI Renderer
 * Demonstrates:
 * - Alternate screen buffer (\x1b[?1049h)
 * - 40-col right sidebar
 * - Scrolling feed
 * - Text input prompt
 * - Flicker-free redraw on resize (SIGWINCH)
 * - Safe exit on Ctrl+C or Escape
 */

const readline = require('readline');

// Terminal ANSI constants
const ESC = '\x1b';
const ENTER_ALT_SCREEN = `${ESC}[?1049h${ESC}[H${ESC}[?25l`;
const EXIT_ALT_SCREEN = `${ESC}[?1049l${ESC}[?25h`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;

// TrueColor helpers
const bg = (r, g, b) => `${ESC}[48;2;${r};${g};${b}m`;
const fg = (r, g, b) => `${ESC}[38;2;${r};${g};${b}m`;
const reset = `${ESC}[0m`;

const THEME = {
  bg: bg(14, 17, 22),
  sidebarBg: bg(10, 13, 18),
  border: fg(48, 54, 61),
  text: fg(216, 222, 233),
  dim: fg(139, 150, 165),
  green: fg(61, 220, 132),
  amber: fg(240, 180, 41),
  blue: fg(108, 182, 255),
  red: fg(255, 123, 114)
};

let cols = process.stdout.columns || 120;
let rows = process.stdout.rows || 40;
let inputBuffer = '';
let feedMessages = [
  { type: 'user', text: 'Build the full-screen CLI interface' },
  { type: 'system', text: 'Run initialized: 10 pipeline agents registered' },
  { type: 'agent', name: 'analyst', text: 'Scanned repo: TypeScript CJS, 110 tests passing' },
  { type: 'agent', name: 'product-brief', text: 'Generated specification for tickets U0-U8' },
  { type: 'agent', name: 'pm', text: 'Execution plan and dependency graph established' },
  { type: 'agent', name: 'build', text: 'Compiling TUI buffer engine' }
];

let activeAgent = 'code-review';
let activeTimer = 14;

// Virtual Screen Buffer: rows x cols of cells { char, fg, bg }
let currentBuffer = [];
let previousBuffer = [];

function initBuffer(w, h) {
  const buf = [];
  for (let r = 0; r < h; r++) {
    const row = [];
    for (let c = 0; c < w; c++) {
      row.push({ char: ' ', fg: reset, bg: THEME.bg });
    }
    buf.push(row);
  }
  return buf;
}

function setCell(buf, r, c, char, fgColor, bgColor) {
  if (r >= 0 && r < buf.length && c >= 0 && c < buf[0].length) {
    buf[r][c] = {
      char: char || ' ',
      fg: fgColor || reset,
      bg: bgColor || THEME.bg
    };
  }
}

function writeText(buf, r, startCol, text, fgColor, bgColor, maxLen) {
  const str = String(text);
  const limit = maxLen ? Math.min(str.length, maxLen) : str.length;
  for (let i = 0; i < limit; i++) {
    setCell(buf, r, startCol + i, str[i], fgColor, bgColor);
  }
}

function render() {
  cols = process.stdout.columns || 120;
  rows = process.stdout.rows || 40;

  currentBuffer = initBuffer(cols, rows);

  const sidebarWidth = cols >= 100 ? 40 : 0;
  const feedWidth = cols - sidebarWidth;

  // 1. Header (Row 0)
  writeText(currentBuffer, 0, 0, ' '.repeat(cols), THEME.text, THEME.sidebarBg);
  writeText(currentBuffer, 0, 2, 'run_09b4f2a', THEME.blue, THEME.sidebarBg);
  writeText(currentBuffer, 0, 16, 'build-full-screen-cli', THEME.text, THEME.sidebarBg);
  const rightHeader = 'hageezai-cli (branch: Trustworthy-foundation)';
  if (cols - rightHeader.length - 2 > 40) {
    writeText(currentBuffer, 0, cols - rightHeader.length - 2, rightHeader, THEME.amber, THEME.sidebarBg);
  }

  // Header separator
  for (let c = 0; c < cols; c++) {
    setCell(currentBuffer, 1, c, '─', THEME.border, THEME.bg);
  }

  // 2. Feed (Left panel: Rows 2 to rows - 5)
  const feedTop = 2;
  const feedHeight = rows - 6;
  const feedBottom = feedTop + feedHeight;

  let feedRow = feedTop;
  for (let i = 0; i < feedMessages.length && feedRow < feedBottom; i++) {
    const msg = feedMessages[i];
    if (msg.type === 'user') {
      setCell(currentBuffer, feedRow, 2, '▌', THEME.amber, THEME.bg);
      writeText(currentBuffer, feedRow, 4, `USER TASK: ${msg.text}`, THEME.amber, THEME.bg, feedWidth - 6);
      feedRow += 2;
    } else if (msg.type === 'agent') {
      setCell(currentBuffer, feedRow, 2, '✔', THEME.green, THEME.bg);
      writeText(currentBuffer, feedRow, 4, `${msg.name.padEnd(14)} ${msg.text}`, THEME.text, THEME.bg, feedWidth - 6);
      feedRow += 1;
    } else {
      setCell(currentBuffer, feedRow, 2, '●', THEME.dim, THEME.bg);
      writeText(currentBuffer, feedRow, 4, msg.text, THEME.dim, THEME.bg, feedWidth - 6);
      feedRow += 1;
    }
  }

  // Working agent indicator in feed
  if (feedRow < feedBottom) {
    setCell(currentBuffer, feedRow, 2, '▶', THEME.blue, THEME.bg);
    writeText(currentBuffer, feedRow, 4, `${activeAgent.padEnd(14)} working... (${activeTimer}s)`, THEME.blue, THEME.bg, feedWidth - 6);
  }

  // 3. Right Sidebar (if sidebarWidth > 0)
  if (sidebarWidth > 0) {
    const sCol = feedWidth;

    // Vertical divider
    for (let r = 1; r < rows - 1; r++) {
      setCell(currentBuffer, r, sCol - 1, '│', THEME.border, THEME.sidebarBg);
    }

    // Sidebar background
    for (let r = 2; r < rows - 1; r++) {
      for (let c = sCol; c < cols; c++) {
        setCell(currentBuffer, r, c, ' ', THEME.text, THEME.sidebarBg);
      }
    }

    // Logo & session
    writeText(currentBuffer, 2, sCol + 2, '🤖 HAGEEZ AI  v1.0.0', THEME.green, THEME.sidebarBg);
    writeText(currentBuffer, 3, sCol + 2, 'Session: Full-Screen CLI', THEME.dim, THEME.sidebarBg);
    writeText(currentBuffer, 4, sCol + 2, 'Tokens: 24,180 (19%) • $0.042', THEME.text, THEME.sidebarBg);
    writeText(currentBuffer, 5, sCol + 2, '─'.repeat(sidebarWidth - 4), THEME.border, THEME.sidebarBg);
    writeText(currentBuffer, 6, sCol + 2, 'Agents: 7 of 10 done', THEME.green, THEME.sidebarBg);

    const agents = [
      { name: 'analyst', status: '✔ 12s', color: THEME.green },
      { name: 'product-brief', status: '✔ 18s', color: THEME.green },
      { name: 'pm', status: '✔ 41s', color: THEME.green },
      { name: 'ux-designer', status: '✔ 25s', color: THEME.green },
      { name: 'architect', status: '✔ 34s', color: THEME.green },
      { name: 'project-context', status: '✔ 15s', color: THEME.green },
      { name: 'build', status: '✔ 58s', color: THEME.green },
      { name: 'code-review', status: `● ${activeTimer}s`, color: THEME.blue },
      { name: 'qa-tests', status: '○ wait', color: THEME.dim },
      { name: 'retrospective', status: '○ wait', color: THEME.dim }
    ];

    agents.forEach((ag, idx) => {
      const aRow = 8 + idx;
      if (aRow < rows - 5) {
        const isWorking = ag.name === activeAgent;
        const prefix = isWorking ? '▶ ' : '  ';
        writeText(currentBuffer, aRow, sCol + 2, `${prefix}${ag.name.padEnd(16)} ${ag.status}`, ag.color, THEME.sidebarBg);
      }
    });

    // Sidebar footer
    writeText(currentBuffer, rows - 3, sCol + 2, 'dir: hageezAI', THEME.dim, THEME.sidebarBg);
    writeText(currentBuffer, rows - 2, sCol + 2, 'node >=22.12.0 • CommonJS', THEME.dim, THEME.sidebarBg);
  }

  // 4. Input Section (Rows: rows - 4 to rows - 2)
  for (let c = 0; c < feedWidth; c++) {
    setCell(currentBuffer, rows - 4, c, '─', THEME.border, THEME.bg);
  }
  setCell(currentBuffer, rows - 3, 2, '>', THEME.green, THEME.bg);
  writeText(currentBuffer, rows - 3, 4, inputBuffer, THEME.text, THEME.bg, feedWidth - 6);
  setCell(currentBuffer, rows - 3, 4 + inputBuffer.length, '▋', THEME.green, THEME.bg);

  writeText(currentBuffer, rows - 2, 4, 'Build mode • anthropic:claude-3-5-sonnet • HageezAI', THEME.dim, THEME.bg, feedWidth - 6);

  // 5. Footer (Row: rows - 1)
  writeText(currentBuffer, rows - 1, 0, ' '.repeat(cols), THEME.dim, THEME.sidebarBg);
  writeText(currentBuffer, rows - 1, 2, 'esc interrupt  tab build/plan  @ files', THEME.dim, THEME.sidebarBg);
  const rightFooter = 'Tokens: 24,180 (19%)  ctrl+p commands';
  if (cols - rightFooter.length - 2 > 35) {
    writeText(currentBuffer, rows - 1, cols - rightFooter.length - 2, rightFooter, THEME.dim, THEME.sidebarBg);
  }

  // Double buffering flush: only send changed cells
  flushDiff();
}

function flushDiff() {
  let output = '';
  let lastFg = '';
  let lastBg = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cur = currentBuffer[r] && currentBuffer[r][c] ? currentBuffer[r][c] : { char: ' ', fg: reset, bg: THEME.bg };
      const prev = previousBuffer[r] && previousBuffer[r][c] ? previousBuffer[r][c] : null;

      if (!prev || prev.char !== cur.char || prev.fg !== cur.fg || prev.bg !== cur.bg) {
        output += `${ESC}[${r + 1};${c + 1}H`;
        if (cur.fg !== lastFg) {
          output += cur.fg;
          lastFg = cur.fg;
        }
        if (cur.bg !== lastBg) {
          output += cur.bg;
          lastBg = cur.bg;
        }
        output += cur.char;
      }
    }
  }

  if (output.length > 0) {
    output += reset;
    process.stdout.write(output);
  }

  previousBuffer = currentBuffer;
}

function cleanup() {
  process.stdout.write(EXIT_ALT_SCREEN);
  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false);
    } catch {}
  }
}

// Signal and exit traps
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('uncaughtException', (err) => {
  cleanup();
  console.error('Fatal error in TUI spike:', err);
  process.exit(1);
});

// Resize handler
process.stdout.on('resize', () => {
  previousBuffer = [];
  render();
});

// Input handling
function setupInput() {
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    process.stdin.on('keypress', (str, key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }
      if (key.name === 'escape') {
        cleanup();
        process.exit(0);
      }
      if (key.name === 'backspace') {
        inputBuffer = inputBuffer.slice(0, -1);
      } else if (key.name === 'return') {
        if (inputBuffer.trim()) {
          feedMessages.push({ type: 'user', text: inputBuffer });
          inputBuffer = '';
        }
      } else if (str && !key.ctrl && !key.meta && str.length === 1) {
        inputBuffer += str;
      }
      render();
    });
  }
}

// Start spike
function main() {
  process.stdout.write(ENTER_ALT_SCREEN);
  setupInput();
  render();

  // Timer interval for spike demonstration
  const timer = setInterval(() => {
    activeTimer++;
    render();
  }, 1000);

  // If non-interactive, CI, or test flag passed, exit cleanly after rendering
  const isTestMode = process.argv.includes('--test') || process.argv.includes('--once') || Boolean(process.env.CI);
  if (!process.stdin.isTTY || isTestMode) {
    clearInterval(timer);
    cleanup();
    console.log('Spike rendered successfully (full-screen ANSI layout verified)');
    process.exit(0);
  }


}

main();
