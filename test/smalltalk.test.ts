import { test } from 'node:test';
import * as assert from 'node:assert';
import { isSmallTalk } from '../src/ui/repl';

test('smalltalk: identifies greetings and conversational questions', () => {
  assert.strictEqual(isSmallTalk('hi'), true);
  assert.strictEqual(isSmallTalk('hello'), true);
  assert.strictEqual(isSmallTalk('hey there'), true);
  assert.strictEqual(isSmallTalk('how are you?'), true);
  assert.strictEqual(isSmallTalk('what can you do?'), true);
  assert.strictEqual(isSmallTalk('good morning'), true);
  assert.strictEqual(isSmallTalk('I need to test Agents so I need you to give me the answer to my hi'), true);
});

test('smalltalk: distinguishes engineering tasks from small talk', () => {
  assert.strictEqual(isSmallTalk('build the full-screen CLI interface'), false);
  assert.strictEqual(isSmallTalk('fix bug in approval.ts'), false);
  assert.strictEqual(isSmallTalk('create a new unit test for layout'), false);
  assert.strictEqual(isSmallTalk('add agent sprites to the sidebar'), false);
  assert.strictEqual(isSmallTalk('implement the state reducer'), false);
});
