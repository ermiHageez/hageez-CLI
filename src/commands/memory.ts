import {
  buildMemoryContext,
  listDecisions,
  recallDecisions,
  rememberDecision,
  removeDecision,
} from '../memory';
import { theme, success, warn } from '../ui/theme';

export async function runMemory(
  action: string | undefined,
  key: string | undefined,
  value: string | undefined,
  options: { keyword?: string; debug?: boolean } = {}
): Promise<void> {
  const projectPath = process.cwd();
  switch (action) {
    case 'add': {
      if (!key || !value) throw new Error('Usage: hageez memory add <key> <value>');
      await rememberDecision(key, value, projectPath);
      console.log(success(`  ✓ Decision ${key} saved`));
      return;
    }
    case 'remove': {
      if (!key) throw new Error('Usage: hageez memory remove <key>');
      const removed = await removeDecision(key, projectPath);
      console.log(removed ? success(`  ✓ Decision ${key} removed`) : warn(`  Decision ${key} was not found`));
      return;
    }
    case 'list':
    case undefined: {
      const decisions = recallDecisions(projectPath, options.keyword);
      if (decisions.length === 0) {
        console.log(theme.dim('  No Decisions recorded for this project.'));
        return;
      }
      console.log('');
      for (const decision of decisions) {
        console.log(`  ${theme.cyan(decision.key)}  ${theme.dim(decision.type)}  ${theme.dim(decision.updatedAt)}`);
        if (!options.debug) console.log(`    ${decision.value}`);
      }
      console.log('');
      return;
    }
    case 'debug': {
      const decisions = recallDecisions(projectPath, options.keyword);
      console.log('');
      console.log(theme.cyan('  Recall debug (metadata only)'));
      console.log(theme.dim(`  ${decisions.length} Decision(s)${options.keyword ? ` matching "${options.keyword}"` : ''}`));
      for (const decision of decisions) {
        console.log(`  - ${decision.key} | ${decision.type} | ${decision.updatedAt}`);
      }
      const context = buildMemoryContext(projectPath, options.keyword);
      console.log(theme.dim(`  Prompt injection size: ${context.length} characters`));
      console.log('');
      return;
    }
    default:
      throw new Error(`Unknown memory action: ${action}`);
  }
}
