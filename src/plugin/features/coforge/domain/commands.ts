import type { ChatSource } from './types';
import { ideaIdFor } from './types';

export type ParsedCommand =
  | { type: 'request'; projectId: string; text: string }
  | { type: 'vote'; ideaId: string }
  | { type: 'status'; ideaId: string }
  | { type: 'me' }
  | { type: 'help' }
  | { type: 'message' }
  | { type: 'invalid'; message: string };

const ID_PATTERN = /^[#$]?(?:CF-?)?(\d{1,7})$/i;

function ideaReference(value: string): string | null {
  const match = value.match(ID_PATTERN);
  return match?.[1] && Number(match[1]) > 0 ? ideaIdFor(Number(match[1])) : null;
}

/** Parses the viewer chat commands: !request, !vote, !status, !me and !help. */
export function parseCommand(text: string): ParsedCommand {
  const value = text.trim();
  if (/^!request(?:\s|$)/i.test(value)) {
    const match = /^!request\s+(CFP-\d{3,7})\s+([\s\S]+)$/i.exec(value);
    if (!match?.[1] || !match[2] || Number(match[1].slice(4)) < 1) return { type: 'invalid', message: 'Include a project ID: !request CFP-001 Your feature idea.' };
    const idea = match[2].trim();
    if (idea.length < 5) return { type: 'invalid', message: 'Add a feature idea after the project ID (at least 5 characters).' };
    if (idea.length > 1500) return { type: 'invalid', message: 'Keep a feature request under 1,500 characters.' };
    return { type: 'request', projectId: match[1].toUpperCase(), text: idea };
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

export const HELP_TEXT = 'Suggest: !request CFP-001 your feature idea (project ID required) · Support: !vote CF-101 · Track: !status CF-101 · Your contribution: !me · One vote per viewer, per idea.';
