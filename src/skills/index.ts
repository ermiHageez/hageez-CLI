import * as fs from 'fs';
import * as path from 'path';
import { getSkillsDir, HageezError } from '../core';

export type SkillScope = 'project' | 'global';

export interface SkillDefinition {
  name: string;
  description: string;
  appliesTo: string[];
  enabled: boolean;
  content: string;
  scope: SkillScope;
  file: string;
}

function projectSkillsDir(projectPath?: string): string {
  return path.join(projectPath ?? process.cwd(), 'ai-learning', 'skills');
}

export function skillDir(scope: SkillScope, projectPath?: string): string {
  return scope === 'global' ? getSkillsDir() : projectSkillsDir(projectPath);
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } | null {
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return null;
  const header = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\r?\n/, '');
  const meta: Record<string, string> = {};
  for (const line of header.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    meta[match[1]] = match[2].trim();
  }
  return { meta, body };
}

function parseSkill(raw: string, scope: SkillScope, file: string): SkillDefinition | null {
  const parsed = parseFrontmatter(raw);
  if (!parsed) return null;
  const name = parsed.meta.name?.trim();
  if (!name) return null;
  const appliesTo = (parsed.meta.appliesTo ?? parsed.meta.applies ?? '*')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return {
    name,
    description: parsed.meta.description ?? '',
    appliesTo: appliesTo.length > 0 ? appliesTo : ['*'],
    enabled: parsed.meta.enabled !== 'false',
    content: parsed.body.trim(),
    scope,
    file,
  };
}

function readDir(dir: string, scope: SkillScope): SkillDefinition[] {
  if (!fs.existsSync(dir)) return [];
  const skills: SkillDefinition[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.md')) continue;
    const file = path.join(dir, entry);
    try {
      const parsed = parseSkill(fs.readFileSync(file, 'utf-8'), scope, file);
      if (parsed) skills.push(parsed);
    } catch {
      // Invalid skills are ignored so a run cannot fail because of one file.
    }
  }
  return skills;
}

export function listSkills(projectPath?: string): SkillDefinition[] {
  return [...readDir(projectSkillsDir(projectPath), 'project'), ...readDir(getSkillsDir(), 'global')];
}

export function skillsForAgent(projectPath: string | undefined, agent: string): SkillDefinition[] {
  return listSkills(projectPath).filter(
    (skill) => skill.enabled && (skill.appliesTo.includes('*') || skill.appliesTo.includes(agent))
  );
}

export function buildSkillsContext(projectPath: string | undefined, agent: string): string {
  return skillsForAgent(projectPath, agent)
    .map((skill) => `### ${skill.name}\n${skill.description ? skill.description + '\n' : ''}${skill.content}`)
    .join('\n\n');
}

function safeSkillName(name: string): string {
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  if (!safe || safe === '.' || safe === '..') {
    throw new HageezError('SKILL_INVALID', 'Skill name must contain letters or numbers.');
  }
  return safe;
}

export function addSkill(
  name: string,
  content: string,
  options: { description?: string; agents?: string[]; scope?: SkillScope; enabled?: boolean } = {},
  projectPath?: string
): SkillDefinition {
  const scope = options.scope ?? 'project';
  const safe = safeSkillName(name);
  const dir = skillDir(scope, projectPath);
  fs.mkdirSync(dir, { recursive: true });
  const appliesTo = (options.agents && options.agents.length > 0 ? options.agents : ['*']).join(', ');
  const raw = `---\nname: ${safe}\ndescription: ${options.description ?? ''}\nappliesTo: ${appliesTo}\nenabled: ${options.enabled === false ? 'false' : 'true'}\n---\n\n${content.trim()}\n`;
  const file = path.join(dir, `${safe}.md`);
  fs.writeFileSync(file, raw, 'utf-8');
  return {
    name: safe,
    description: options.description ?? '',
    appliesTo: appliesTo.split(',').map((value) => value.trim()),
    enabled: options.enabled !== false,
    content: content.trim(),
    scope,
    file,
  };
}

function findSkill(name: string, projectPath?: string, scope?: SkillScope): SkillDefinition | undefined {
  return listSkills(projectPath).find(
    (skill) => skill.name === name && (scope === undefined || skill.scope === scope)
  );
}

export function setSkillEnabled(
  name: string,
  enabled: boolean,
  projectPath?: string,
  scope?: SkillScope
): SkillDefinition {
  const skill = findSkill(name, projectPath, scope);
  if (!skill) throw new HageezError('SKILL_NOT_FOUND', `Unknown skill: ${name}`);
  const raw = fs.readFileSync(skill.file, 'utf-8');
  const updated = /^enabled:\s*.*$/m.test(raw)
    ? raw.replace(/^enabled:\s*.*$/m, `enabled: ${enabled ? 'true' : 'false'}`)
    : raw.replace(/^---\r?\n/, `---\nenabled: ${enabled ? 'true' : 'false'}\n`);
  fs.writeFileSync(skill.file, updated, 'utf-8');
  return { ...skill, enabled };
}
