import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  addSkill,
  buildSkillsContext,
  listSkills,
  setSkillEnabled,
  skillsForAgent,
} from '../src/skills';
import { buildAgentSystemPrompt } from '../src/agents/runtime';

function setup(t: { after: (fn: () => void) => void }): { project: string; home: string } {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-skills-project-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hageezai-skills-home-'));
  const previous = process.env.HOME;
  process.env.HOME = home;
  t.after(() => {
    if (previous === undefined) delete process.env.HOME;
    else process.env.HOME = previous;
    fs.rmSync(project, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  });
  return { project, home };
}

test('project and global skills load only for applicable agents', (t) => {
  const { project } = setup(t);
  addSkill('project-tests', 'Always add tests.', {
    agents: ['analyst'],
    description: 'Testing habit',
  }, project);
  addSkill('global-style', 'Prefer small functions.', {
    agents: ['*'],
    scope: 'global',
  }, project);

  assert.equal(listSkills(project).length, 2);
  const analyst = skillsForAgent(project, 'analyst');
  assert.deepEqual(analyst.map((skill) => skill.name).sort(), ['global-style', 'project-tests']);
  assert.deepEqual(skillsForAgent(project, 'pm').map((skill) => skill.name), ['global-style']);
  assert.match(buildSkillsContext(project, 'analyst'), /Always add tests/);
  assert.equal(buildSkillsContext(project, 'pm').includes('Always add tests'), false);
});

test('disabled skills are excluded from prompts', (t) => {
  const { project } = setup(t);
  addSkill('strict-tests', 'Always add tests.', { agents: ['analyst'] }, project);
  assert.match(buildAgentSystemPrompt('analyst', 'task', project), /Always add tests/);
  setSkillEnabled('strict-tests', false, project);
  assert.equal(buildAgentSystemPrompt('analyst', 'task', project).includes('Always add tests'), false);
});

test('invalid skill files do not break discovery or runs', (t) => {
  const { project } = setup(t);
  const dir = path.join(project, 'ai-learning', 'skills');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'broken.md'), 'not frontmatter', 'utf-8');
  addSkill('valid', 'Valid body.', { agents: ['analyst'] }, project);
  assert.deepEqual(listSkills(project).map((skill) => skill.name), ['valid']);
});
