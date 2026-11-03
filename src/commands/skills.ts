import * as fs from 'fs';
import {
  addSkill,
  listSkills,
  setSkillEnabled,
  SkillScope,
} from '../skills';
import { theme, success, warn } from '../ui/theme';

export interface SkillsOptions {
  scope?: string;
  description?: string;
  agents?: string;
  content?: string;
  file?: string;
}

function parseScope(raw?: string): SkillScope {
  if (raw === 'global' || raw === 'project') return raw;
  return 'project';
}

export async function runSkills(
  action: string | undefined,
  name: string | undefined,
  options: SkillsOptions = {}
): Promise<void> {
  const projectPath = process.cwd();
  switch (action) {
    case 'add': {
      if (!name) throw new Error('Usage: hageez skills add <name> --content "..." or --file <path>');
      const content = options.file
        ? fs.readFileSync(options.file, 'utf-8')
        : options.content;
      if (!content?.trim()) {
        throw new Error('Provide skill content with --content or --file.');
      }
      const skill = addSkill(
        name,
        content,
        {
          description: options.description,
          agents: options.agents?.split(',').map((agent) => agent.trim()).filter(Boolean),
          scope: parseScope(options.scope),
        },
        projectPath
      );
      console.log(success(`  ✓ Skill ${skill.name} added (${skill.scope})`));
      return;
    }
    case 'enable':
    case 'disable': {
      if (!name) throw new Error(`Usage: hageez skills ${action} <name>`);
      const skill = setSkillEnabled(name, action === 'enable', projectPath, parseScope(options.scope));
      console.log(success(`  ✓ Skill ${skill.name} ${action}d`));
      return;
    }
    case 'list':
    case undefined: {
      const skills = listSkills(projectPath);
      if (skills.length === 0) {
        console.log(theme.dim('  No Skills found. Add one with `hageez skills add`.'));
        return;
      }
      console.log('');
      for (const skill of skills) {
        console.log(
          `  ${skill.enabled ? success('✓') : warn('○')} ${theme.cyan(skill.name)}  ` +
          `${theme.dim(skill.scope)}  ${theme.dim(skill.appliesTo.join(', '))}`
        );
        if (skill.description) console.log(`    ${skill.description}`);
      }
      console.log('');
      return;
    }
    default:
      throw new Error(`Unknown skills action: ${action}`);
  }
}
