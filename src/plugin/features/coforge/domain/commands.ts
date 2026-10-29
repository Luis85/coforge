import type { ChatSource } from './types';
import { ideaIdFor } from './types';
import { helpTopic, type ViewerHelpTopic } from './viewer-help';

export type ParsedCommand =
  | { type: 'request' | 'bug'; projectId: string; text: string }
  | { type: 'projects'; page: number }
  | { type: 'shop'; page: number }
  | { type: 'odds'; lootboxId: string; page: number }
  | { type: 'redeem'; rewardId: string }
  | { type: 'lootbox'; lootboxId: string }
  | { type: 'ranks'; page: number }
  | { type: 'vote'; ideaId: string }
  | { type: 'context'; ideaId: string; text: string }
  | { type: 'status'; ideaId: string }
  | { type: 'me' }
  | { type: 'register' }
  | { type: 'help'; topic?: ViewerHelpTopic }
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
  if (/^!(?:shop|odds|redeem|lootbox)(?:\s|$)/i.test(value)) {
    const parts = value.split(/\s+/); const command = parts[0]!.toLowerCase();
    if (command === '!shop' && parts.length <= 2 && (!parts[1] || /^[1-9]\d{0,2}$/.test(parts[1]))) return { type: 'shop', page: Number(parts[1] ?? 1) };
    if (command === '!odds' && parts[1] && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(parts[1]) && parts.length <= 3 && (!parts[2] || /^[1-9]\d{0,2}$/.test(parts[2]))) return { type: 'odds', lootboxId: parts[1], page: Number(parts[2] ?? 1) };
    if (parts.length === 2 && parts[1] && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(parts[1])) {
      if (command === '!redeem') return { type: 'redeem', rewardId: parts[1] };
      if (command === '!lootbox') return { type: 'lootbox', lootboxId: parts[1] };
    }
    return { type: 'invalid', message: 'Use !shop [page], !odds <lootbox-id> [page], !redeem <reward-id>, or !lootbox <id>.' };
  }
  if (/^!register\s*$/i.test(value)) return { type: 'register' };
  if (/^!context(?:\s|$)/i.test(value)) {
    const match = /^!context\s+(\S+)\s+([\s\S]+)$/i.exec(value);
    const ideaId = match?.[1] ? ideaReference(match[1]) : null; const context = match?.[2]?.trim() ?? '';
    return ideaId && context.length >= 3 && context.length <= 1500 ? { type: 'context', ideaId, text: context } : { type: 'invalid', message: 'Use !context <request-id> Your extra details (3–1,500 characters).' };
  }
  if (/^!ranks(?:\s|$)/i.test(value)) {
    const match = /^!ranks(?:\s+([1-9]\d?))?$/i.exec(value);
    return match ? { type: 'ranks', page: Number(match[1] ?? 1) } : { type: 'invalid', message: 'Use !ranks or !ranks 2 for another page.' };
  }
  if (/^!(?:request|bug)(?:\s|$)/i.test(value)) {
    const match = /^!(request|bug)\s+(CFP-\d{3,7})\s+([\s\S]+)$/i.exec(value);
    if (!match?.[2] || !match[3] || Number(match[2].slice(4)) < 1) return { type: 'invalid', message: 'Include a project ID: !request <project-id> Your feature idea, or !bug <project-id> Describe the bug. Use !projects for public IDs.' };
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
    return ideaId ? { type: 'vote', ideaId } : { type: 'invalid', message: 'Use !vote <request-id> (one idea ID per vote).' };
  }
  if (/^!help(?:\s|$)/i.test(value)) {
    const match = /^!help(?:\s+(\S+))?\s*$/i.exec(value);
    if (match && !match[1]) return { type: 'help' };
    const topic = match?.[1] ? helpTopic(match[1]) : null;
    return topic ? { type: 'help', topic } : { type: 'invalid', message: 'Use !help, !help requests, !help progress or !help community (also !help 1–4).' };
  }
  if (/^!me\s*$/i.test(value)) return { type: 'me' };
  if (/^!status(?:\s|$)/i.test(value)) {
    const ideaId = ideaReference(value.replace(/^!status\s*/i, ''));
    return ideaId ? { type: 'status', ideaId } : { type: 'invalid', message: 'Use !status <request-id> to track a public idea.' };
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
