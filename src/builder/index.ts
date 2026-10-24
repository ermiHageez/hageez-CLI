import * as fs from 'fs';
import * as path from 'path';
import { HageezConfig, ProjectContext } from '../core';
import { callLLM, buildSystemPrompt } from '../core';

export interface BuilderResult {
  content: string;
  tokensUsed: number;
  files: Array<{ path: string; action: 'create' | 'modify' | 'delete'; content?: string }>;
}

export interface Builder {
  generate: (task: string, project: ProjectContext, plan: string, fileContext?: string) => Promise<BuilderResult>;
}

function extractCodeFromResponse(content: string): string {
  // Try to extract code from markdown code blocks
  const patterns = [
    /```(?:typescript|javascript|ts|js)\s*\n([\s\S]*?)```/g,
    /```\s*\n([\s\S]*?)```/g,
  ];

  for (const pattern of patterns) {
    const matches = [...content.matchAll(pattern)];
    if (matches.length > 0) {
      // Return the longest code block (likely the full file)
      return matches.reduce((best, m) => m[1].length > best.length ? m[1] : best, '');
    }
  }

  // If no code blocks, return the content as-is (strip any non-code lines)
  const lines = content.split('\n');
  const codeLines = lines.filter(l =>
    !l.startsWith('#') &&
    !l.startsWith('Here') &&
    !l.startsWith('The ') &&
    !l.startsWith('This ') &&
    !l.startsWith('Updated') &&
    !l.startsWith('Changes') &&
    l.trim().length > 0
  );
  return codeLines.join('\n');
}

function writeFiles(files: BuilderResult['files'], projectRoot: string): { written: string[]; errors: string[] } {
  const written: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const fullPath = path.resolve(projectRoot, file.path);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (file.action === 'delete') {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          written.push(`DELETE ${file.path}`);
        }
      } else if (file.content !== undefined) {
        fs.writeFileSync(fullPath, file.content, 'utf-8');
        written.push(`${file.action === 'create' ? 'CREATE' : 'UPDATE'} ${file.path}`);
      }
    } catch (err) {
      errors.push(`Failed to ${file.action} ${file.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { written, errors };
}

export function createBuilder(config: HageezConfig): Builder {
  return {
    async generate(task: string, project: ProjectContext, plan: string, fileContext?: string): Promise<BuilderResult> {
      // Parse file context to get files to modify
      const filesToModify: Array<{ path: string; content: string }> = [];
      if (fileContext) {
        const filePattern = /### (.+?)\n```\n([\s\S]*?)```/g;
        let m;
        while ((m = filePattern.exec(fileContext)) !== null) {
          filesToModify.push({ path: m[1], content: m[2] });
        }
      }

      // If we have files to modify, update them directly
      if (filesToModify.length > 0) {
        const files: BuilderResult['files'] = [];
        for (const f of filesToModify) {
          const sys = `You are an expert code editor. You modify existing files.
Your response MUST contain ONLY the complete updated file code inside a single TypeScript code block.
No explanations, no markdown headers, no other text. Just the code.`;

          const res = await callLLM(config, [
            { role: 'system', content: sys },
            {
              role: 'user',
              content: `Update this file for the task: "${task}"

Current file path: ${f.path}

Current file content:
\`\`\`
${f.content}
\`\`\`

Output the COMPLETE updated file. Only the code block, nothing else.`,
            },
          ]);

          const code = extractCodeFromResponse(res.content);
          if (code.trim().length > 0) {
            files.push({ path: f.path, action: 'modify', content: code });
          }
          return { content: res.content, tokensUsed: res.tokensUsed, files };
        }
      }

      // No file context — ask LLM to create new file
      const sys = `You are an expert code generator. You create new files.
Your response MUST contain ONLY the complete file code inside a single TypeScript code block.
No explanations, no markdown headers, no other text. Just the code.`;

      const res = await callLLM(config, [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: `Create a file for this task: "${task}"

Project: ${project.name}
Language: ${project.language ?? 'TypeScript'}

Output the COMPLETE file. Only the code block, nothing else.`,
        },
      ]);

      const code = extractCodeFromResponse(res.content);
      const fileName = task.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '.ts';
      const files: BuilderResult['files'] = code.trim().length > 0
        ? [{ path: fileName, action: 'create', content: code }]
        : [];

      return { content: res.content, tokensUsed: res.tokensUsed, files };
    },
  };
}

export function applyBuilderResult(result: BuilderResult, projectRoot: string): { written: string[]; errors: string[] } {
  return writeFiles(result.files, projectRoot);
}
