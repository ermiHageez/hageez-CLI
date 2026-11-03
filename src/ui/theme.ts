import chalk from 'chalk';
import { getVersion } from '../core/version';

export const theme = {
  primary: chalk.hex('#39FF14'),
  cyan: chalk.hex('#00e5ff'),
  green: chalk.hex('#00ff88'),
  yellow: chalk.hex('#ffdd00'),
  dim: chalk.hex('#555566'),
  white: chalk.hex('#e8e8f0'),
  red: chalk.hex('#ff4444'),
  gray: chalk.hex('#888899'),
  box: chalk.hex('#1a1a2e'),
};

export const label = (text: string): string => theme.dim(text);
export const value = (text: string): string => theme.cyan(text);
export const success = (text: string): string => theme.green(text);
export const warn = (text: string): string => theme.yellow(text);
export const error = (text: string): string => theme.red(text);
export const highlight = (text: string): string => theme.yellow(text);
export const command = (text: string): string => theme.primary(text);

export const separator = (): string =>
  theme.dim('─'.repeat(process.stdout.columns || 80));

export const miniSep = (len = 40): string => theme.dim('─'.repeat(len));

export const badge = (text: string, color: 'green' | 'cyan' | 'red' | 'yellow' | 'primary'): string => {
  const colors: Record<string, typeof chalk> = {
    green: chalk.bgHex('#00ff88').black,
    cyan: chalk.bgHex('#00e5ff').black,
    red: chalk.bgHex('#ff4444').white,
    yellow: chalk.bgHex('#ffdd00').black,
    primary: chalk.bgHex('#39FF14').black,
  };
  return (colors[color] || colors.green)(` ${text} `);
};

export const VERSION = getVersion();
