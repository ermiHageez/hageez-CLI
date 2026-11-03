import * as path from 'path';
import * as fs from 'fs';

export interface SpriteCell {
  top: [number, number, number];
  bottom: [number, number, number];
}

export interface SpriteData {
  badge: string;
  color: string;
  frame1: SpriteCell[][];
  frame2: SpriteCell[][];
}

let loadedSprites: Record<string, SpriteData> | null = null;

export function loadSpriteMap(): Record<string, SpriteData> {
  if (loadedSprites) return loadedSprites;
  try {
    const jsonModule = require('./map.json');
    if (jsonModule && Object.keys(jsonModule).length > 0) {
      loadedSprites = jsonModule;
      return loadedSprites!;
    }
  } catch {}

  const candidates = [
    path.join(__dirname, 'map.json'),
    path.join(__dirname, '..', '..', 'src', 'ui', 'sprites', 'map.json'),
    path.join(__dirname, '..', '..', '..', 'src', 'ui', 'sprites', 'map.json'),
    path.join(process.cwd(), 'src', 'ui', 'sprites', 'map.json'),
    path.join(process.cwd(), 'dist', 'ui', 'sprites', 'map.json'),
    path.join(process.cwd(), 'dist-test', 'src', 'ui', 'sprites', 'map.json'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        loadedSprites = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        return loadedSprites!;
      }
    } catch {}
  }
  return {};
}


export function getSpriteData(agentId: string): SpriteData | undefined {
  const map = loadSpriteMap();
  return map[agentId] || map['analyst'];
}

export function isNoColor(): boolean {
  return Boolean(process.env.NO_COLOR && process.env.NO_COLOR !== '0');
}

export function isNoAnim(): boolean {
  return Boolean(process.env.HAGEEZ_NO_ANIM === '1' || isNoColor());
}

/**
 * Renders an 8x3 half-block ANSI character sprite.
 * Each character cell is '▀' with foreground=top pixel and background=bottom pixel.
 */
export function renderHalfBlockSprite(
  agentId: string,
  frame: 1 | 2 = 1,
  dimmed: boolean = false
): string[] {
  if (isNoColor()) {
    return renderBadgeLines(agentId, dimmed);
  }

  const sprite = getSpriteData(agentId);
  if (!sprite) {
    return renderBadgeLines(agentId, dimmed);
  }

  const activeFrame = isNoAnim() ? sprite.frame1 : frame === 2 ? sprite.frame2 : sprite.frame1;
  const dimFactor = dimmed ? 0.45 : 1.0;
  const lines: string[] = [];

  for (const row of activeFrame) {
    let line = '';
    for (const cell of row) {
      const topR = Math.round(cell.top[0] * dimFactor);
      const topG = Math.round(cell.top[1] * dimFactor);
      const topB = Math.round(cell.top[2] * dimFactor);

      const botR = Math.round(cell.bottom[0] * dimFactor);
      const botG = Math.round(cell.bottom[1] * dimFactor);
      const botB = Math.round(cell.bottom[2] * dimFactor);

      line += `\x1b[38;2;${topR};${topG};${topB}m\x1b[48;2;${botR};${botG};${botB}m▀`;
    }
    line += '\x1b[0m';
    lines.push(line);
  }

  return lines;
}

export function renderBadge(agentId: string, dimmed: boolean = false): string {
  const sprite = getSpriteData(agentId);
  const badge = sprite?.badge || agentId.slice(0, 3).toUpperCase();
  return `[${badge}]`;
}

function renderBadgeLines(agentId: string, dimmed: boolean): string[] {
  const badge = renderBadge(agentId, dimmed);
  return ['        ', ` ${badge}   `, '        '];
}
