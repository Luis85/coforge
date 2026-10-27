import type { ChatSource } from './types';
import { ideaIdFor } from './types';

export type ParsedCommand =
  | { type: 'request' | 'bug'; projectId: string; text: string }
  | { type: 'projects'; page: number }
  | { type: 'ranks'; page: number }
  | { type: 'vote'; ideaId: string }
  | { type: 'status'; ideaId: string }
  | { type: 'me' }
  | { type: 'register' }
  | { type: 'help' }
  | { type: 'message' }
  | { type: 'invalid'; message: string };

const ID_PATTERN = /^[#$]?(?:CF-?)?(\d{1,7})$/i;

function ideaReference(value: string): string | null {
  const match = value.match(ID_PATTERN);
  return match?.[1] && Number(match[1]) > 0 ? ideaIdFor(Number(match[1])) : null;
}

/** Parses project discovery, feature/bug intake, voting and viewer status commands. */
export function parseCommand(text: string): ParsedCommand {
  const value = text.trim();
  if (/^!register\s*$/i.test(value)) return { type: 'register' };
  if (/^!ranks(?:\s|$)/i.test(value)) {
    const match = /^!ranks(?:\s+([1-9]\d?))?$/i.exec(value);
    return match ? { type: 'ranks', page: Number(match[1] ?? 1) } : { type: 'invalid', message: 'Use !ranks or !ranks 2 for another page.' };
  }
  if (/^!(?:request|bug)(?:\s|$)/i.test(value)) {
    const match = /^!(request|bug)\s+(CFP-\d{3,7})\s+([\s\S]+)$/i.exec(value);
    if (!match?.[2] || !match[3] || Number(match[2].slice(4)) < 1) return { type: 'invalid', message: 'Include a project ID: !request CFP-001 Your feature idea, or !bug CFP-001 Describe the bug. Use !projects for IDs.' };
    const idea = match[3].trim();
    if (idea.length < 5) return { type: 'invalid', message: 'Describe the feature or bug after the project ID (at least 5 characters).' };
    if (idea.length > 1500) return { type: 'invalid', message: 'Keep a request under 1,500 characters.' };
    return { type: match[1]?.toLowerCase() === 'bug' ? 'bug' : 'request', projectId: match[2].toUpperCase(), text: idea };
  }
  if (/^!projects(?:\s|$)/i.test(value)) {
    const match = /^!projects(?:\s+([1-9]\d?))?$/i.exec(value);
    return match ? { type: 'projects', page: Number(match[1] ?? 1) } : { type: 'invalid', message: 'Use !projects or !projects 2 for another page.' };
  }
  if (/^!vote(?:\s|$)/i.test(value)) {
    const ideaId = ideaReference(value.replace(/^!vote\s*/i, ''));
    return ideaId ? { type: 'vote', ideaId } : { type: 'invalid', message: 'Use !vote CF-101 (one idea ID per vote).' };
  }
  if (/^!help\s*$/i.test(value)) return { type: 'help' };
  if (/^!me\s*$/i.test(value)) return { type: 'me' };
  if (/^!status(?:\s|$)/i.test(value)) {
    const ideaId = ideaReference(value.replace(/^!status\s*/i, ''));
    return ideaId ? { type: 'status', ideaId } : { type: 'invalid', message: 'Use !status CF-101 to track an idea.' };
  }
  return { type: 'message' };
}

/** Stable, provider-prefixed contributor identity. Simulator names are case-insensitive. */
export function identity(input: { username: string; userId?: string; source?: ChatSource }): string {
  const source = input.source ?? 'simulator';
  const id = input.userId?.trim() || input.username.trim().toLocaleLowerCase('en-US');
  const cleanId = id.startsWith(`${source}:`) ? id.slice(source.length + 1) : id;
  return `${source}:${source === 'simulator' ? cleanId.toLocaleLowerCase('en-US') : cleanId}`;
}

export const HELP_TEXT = '!register: join The Hood · !projects: project IDs · !request CFP-001 Your feature idea (5-minute cooldown) · !bug CFP-001 Describe the bug · !vote CF-101 · !status CF-101 · !me: player stats · !ranks: rank ladder. Register before requests, bugs or votes.';
