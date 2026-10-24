import chalk from 'chalk';

export function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const output: string[] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      output.push(chalk.dim(line));
      continue;
    }

    let processed = line.replace(/`([^`]+)`/g, (_, code) => chalk.cyan(code));
    processed = processed.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));
    processed = processed.replace(/\*([^*]+)\*/g, (_, text) => chalk.italic(text));

    if (processed.startsWith('# ')) {
      output.push(chalk.bold.hex('#39FF14')(processed.slice(2)));
    } else if (processed.startsWith('## ')) {
      output.push(chalk.bold.cyan(processed.slice(3)));
    } else if (processed.startsWith('### ')) {
      output.push(chalk.bold.white(processed.slice(4)));
    } else if (/^\s*[-*]\s/.test(processed)) {
      output.push(processed.replace(/^(\s*)[-*]\s/, '$1' + chalk.dim('• ')));
    } else if (/^\s*\d+\.\s/.test(processed)) {
      output.push(processed.replace(/^(\s*)(\d+)\.\s/, '$1' + chalk.dim('$2. ')));
    } else {
      output.push(processed);
    }
  }

  return output.join('\n');
}

export function renderCodeBlock(code: string, lang?: string): string {
  const header = lang ? chalk.dim(`\`\`\`${lang}`) : chalk.dim('```');
  const footer = chalk.dim('```');
  const lines = code.split('\n').map(l => '  ' + chalk.white(l));
  return [header, ...lines, footer].join('\n');
}
