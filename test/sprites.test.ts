import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  loadSpriteMap,
  getSpriteData,
  renderHalfBlockSprite,
  renderBadge,
} from '../src/ui/sprites';
import { CANONICAL_AGENTS } from '../src/ui/state';

test('sprites: all canonical agents and logo exist in map.json with valid 8x3 frames', () => {
  const map = loadSpriteMap();
  assert.ok(map['logo'], 'Logo sprite must be present');

  for (const agent of CANONICAL_AGENTS) {
    const data = map[agent];
    assert.ok(data, `Sprite data for agent ${agent} must exist`);
    assert.strictEqual(data.frame1.length, 3, `${agent} frame1 must have 3 lines`);
    assert.strictEqual(data.frame2.length, 3, `${agent} frame2 must have 3 lines`);

    for (const row of data.frame1) {
      assert.strictEqual(row.length, 8, `${agent} row must have 8 columns`);
      for (const cell of row) {
        assert.strictEqual(cell.top.length, 3, 'top RGB must have 3 components');
        assert.strictEqual(cell.bottom.length, 3, 'bottom RGB must have 3 components');
      }
    }
  }
});

test('sprites: renderHalfBlockSprite outputs 3 lines containing half-blocks', () => {
  const lines = renderHalfBlockSprite('analyst', 1);
  assert.strictEqual(lines.length, 3);
  assert.ok(lines[0].includes('▀'), 'Line must contain Unicode half-block ▀');
  assert.ok(lines[0].includes('\x1b[38;2;'), 'Line must include TrueColor escape sequences');
});

test('sprites: honors NO_COLOR fallback', () => {
  const origNoColor = process.env.NO_COLOR;
  try {
    process.env.NO_COLOR = '1';
    const badge = renderBadge('analyst');
    assert.strictEqual(badge, '[ANA]');
    assert.ok(!badge.includes('\x1b['), 'Must not contain ANSI escape codes');
  } finally {
    if (origNoColor !== undefined) {
      process.env.NO_COLOR = origNoColor;
    } else {
      delete process.env.NO_COLOR;
    }
  }
});

test('sprites: honors HAGEEZ_NO_ANIM=1 by locking to frame 1', () => {
  const origNoAnim = process.env.HAGEEZ_NO_ANIM;
  try {
    process.env.HAGEEZ_NO_ANIM = '1';
    const linesF1 = renderHalfBlockSprite('analyst', 1);
    const linesF2 = renderHalfBlockSprite('analyst', 2);
    assert.deepStrictEqual(linesF1, linesF2, 'Frames must be identical when animations are disabled');
  } finally {
    if (origNoAnim !== undefined) {
      process.env.HAGEEZ_NO_ANIM = origNoAnim;
    } else {
      delete process.env.HAGEEZ_NO_ANIM;
    }
  }
});
