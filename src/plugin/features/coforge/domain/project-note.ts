import { boolean, noteTimestamp, record, text } from './check';
import { settingsCheck } from './persisted';
import { defaultSettings } from './seed';
import { cleanLine, cleanText, defangProperty, escapeMarkdown } from './sanitize';
import { STAGES, type Settings, type StudioProject } from './types';
import { settingsPatch } from './inputs';

export const PROJECT_MARKER = 'coforge-project';
const FIELDS = {
  projectName: 'name', projectBrief: 'description', provider: 'provider', paused: 'paused', intervalSeconds: 'interval-seconds',
  minVotes: 'min-votes', maxTurns: 'max-turns', maxBudgetUsd: 'max-budget-usd', timeoutSeconds: 'timeout-seconds', model: 'model',
  requestCooldownSeconds: 'request-cooldown-seconds',
} as const;
export const PROJECT_PROPERTIES = [
  'type', 'id', 'created', 'updated', 'project-path', 'repository-url', 'website-url', 'worktree-folder', 'allow-implementation', ...Object.values(FIELDS),
  ...STAGES.map(stage => `automation-${stage}`),
];
const projectId = text({ min: 1, max: 80, pattern: /^CFP-\d{3,7}$/ });
const path = text({ trim: true, max: 1000 });

export function validateProjectPath(value: unknown, required = false): string {
  const result = path(value);
  if ([...result].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Project paths cannot contain control characters.');
  if (required && !result) throw new Error('Enter the absolute path to the project repository.');
  if (result && !/^(?:[a-zA-Z]:[\\/]|\/|\\\\)/.test(result)) throw new Error('Project and worktree paths must be absolute paths. They may be outside the vault.');
  return result;
}

export function validateProjectUrl(value: unknown, repository = false): string {
  const result = text({ trim: true, max: 2000 })(value);
  const allowed = repository ? /^(?:(?:https?|ssh):\/\/[^\s/<>]+(?:\/[^\s<>]*)?|git@[^\s:<>]+:[^\s<>]+)$/i : /^https?:\/\/[^\s/<>]+(?:[/?#][^\s<>]*)?$/i;
  if (result && !allowed.test(result)) throw new Error(repository ? 'Use an HTTPS, HTTP, SSH or git@ repository URL.' : 'Use an HTTP or HTTPS website URL.');
  return result;
}

export function projectProperties(project: StudioProject): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: PROJECT_MARKER, id: project.id, created: project.createdAt, updated: project.updatedAt,
    'project-path': project.projectPath, 'worktree-folder': project.worktreeFolder, 'allow-implementation': project.allowImplementation,
    'repository-url': project.repositoryUrl, 'website-url': project.websiteUrl,
  };
  for (const [key, property] of Object.entries(FIELDS) as Array<[keyof typeof FIELDS, string]>) {
    const value = project.settings[key];
    result[property] = typeof value === 'string' ? defangProperty(value) : value;
  }
  for (const stage of STAGES) result[`automation-${stage}`] = project.settings.automation[stage];
  return result;
}

export function applyProjectProperties(frontmatter: Record<string, unknown>, project: StudioProject): void {
  Object.assign(frontmatter, projectProperties(project));
}

export function parseProjectNote(value: unknown): StudioProject | null {
  const properties = record(value);
  if (properties.type !== PROJECT_MARKER) return null;
  const defaults = defaultSettings();
  const values: Record<string, unknown> = { ...defaults };
  for (const [key, property] of Object.entries(FIELDS)) if (properties[property] !== undefined) values[key] = properties[property];
  values.projectName = cleanLine(text({ min: 1, max: 80 })(values.projectName), 80);
  values.projectBrief = cleanText(text({ max: 8000 })(values.projectBrief), 8000);
  const automation: Record<string, unknown> = { ...defaults.automation };
  for (const stage of STAGES) if (properties[`automation-${stage}`] !== undefined) automation[stage] = properties[`automation-${stage}`];
  const settings: Settings = settingsCheck({ ...values, automation });
  settingsPatch(settings);
  return {
    id: projectId(properties.id), settings,
    projectPath: validateProjectPath(properties['project-path'] ?? ''), worktreeFolder: validateProjectPath(properties['worktree-folder'] ?? ''),
    repositoryUrl: validateProjectUrl(properties['repository-url'] ?? '', true), websiteUrl: validateProjectUrl(properties['website-url'] ?? ''),
    allowImplementation: boolean(properties['allow-implementation'] ?? false),
    createdAt: noteTimestamp(properties.created), updatedAt: noteTimestamp(properties.updated),
  };
}

export const projectBody = (project: StudioProject): string => `# ${escapeMarkdown(project.settings.projectName)}\n\n## Notes\n\n`;
