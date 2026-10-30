import { boolean, noteTimestamp, oneOf, record, text } from './check';
import { settingsCheck } from './persisted';
import { defaultSettings } from './seed';
import { cleanLine, cleanText, defangProperty, escapeMarkdown } from './sanitize';
import { STAGES, type Settings, type StudioProject } from './types';
import { settingsPatch } from './inputs';
import { normalizeStagePrompts } from './stage-prompts';
import { normalizeStageAgents, agentModelCheck, stageAgentsCheck } from './stage-agents';
import { workflowDefinitionCheck } from './configured-workflow';
import { restoreWorkflowNoteData, workflowNoteData } from './workflow-note-data';
import { requestObjectDefinitionCheck } from './request-object';
import { projectFeatureGroupsCheck } from './project-feature-groups';

export const PROJECT_MARKER = 'coforge-project';
const FIELDS = {
  agentPrompt: 'agent-prompt',
  projectName: 'name', projectBrief: 'description', provider: 'provider', paused: 'paused', intervalSeconds: 'interval-seconds',
  minVotes: 'min-votes', maxTurns: 'max-turns', maxBudgetUsd: 'max-budget-usd', timeoutSeconds: 'timeout-seconds', model: 'model',
  requestCooldownSeconds: 'request-cooldown-seconds',
} as const;
export const PROJECT_PROPERTIES = [
  'coforge-visibility', 'coforge-feature-groups',
  'type', 'id', 'created', 'updated', 'project-path', 'repository-url', 'website-url', 'worktree-folder', 'allow-implementation', ...Object.values(FIELDS),
  ...STAGES.map(stage => `automation-${stage}`),
  ...STAGES.map(stage => `agent-prompt-${stage}`),
  'herdr-agent', ...STAGES.map(stage => `agent-herdr-agent-${stage}`),
  'workflow-definition',
  'request-object-definition',
  ...STAGES.flatMap(stage => [`agent-provider-${stage}`, `agent-model-${stage}`]),
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
    ...(project.featureGroups === undefined ? {} : { 'coforge-feature-groups': projectFeatureGroupsCheck(project.featureGroups) }),
    'coforge-visibility': project.visibility ?? 'public',
    type: PROJECT_MARKER, id: project.id, created: project.createdAt, updated: project.updatedAt,
    'project-path': project.projectPath, 'worktree-folder': project.worktreeFolder, 'allow-implementation': project.allowImplementation,
    'repository-url': project.repositoryUrl, 'website-url': project.websiteUrl,
  };
  for (const [key, property] of Object.entries(FIELDS) as Array<[keyof typeof FIELDS, string]>) {
    const value = project.settings[key];
    result[property] = typeof value === 'string' ? defangProperty(value) : value;
  }
  for (const stage of STAGES) result[`automation-${stage}`] = project.settings.automation[stage];
  if (project.settings.herdrAgent) result['herdr-agent'] = project.settings.herdrAgent;
  if (project.settings.workflow) result['workflow-definition'] = workflowNoteData(workflowDefinitionCheck(project.settings.workflow));
  if (project.settings.requestObject !== undefined) result['request-object-definition'] = workflowNoteData(requestObjectDefinitionCheck(project.settings.requestObject));
  for (const stage of STAGES) if (project.settings.stagePrompts?.[stage]) result[`agent-prompt-${stage}`] = defangProperty(project.settings.stagePrompts[stage] ?? '');
  for (const stage of STAGES) {
    const agent = project.settings.stageAgents?.[stage];
    if (agent?.provider !== undefined) result[`agent-provider-${stage}`] = agent.provider;
    if (agent?.model !== undefined) result[`agent-model-${stage}`] = defangProperty(agent.model);
    if (agent?.herdrAgent !== undefined) result[`agent-herdr-agent-${stage}`] = agent.herdrAgent;
  }
  return result;
}

export function applyProjectProperties(frontmatter: Record<string, unknown>, project: StudioProject): void {
  const next = projectProperties(project);
  for (const key of PROJECT_PROPERTIES) { if (key in next) frontmatter[key] = next[key]; else delete frontmatter[key]; }
}

export function parseProjectNote(value: unknown): StudioProject | null {
  const properties = record(value);
  if (properties.type !== PROJECT_MARKER) return null;
  const defaults = defaultSettings();
  const values: Record<string, unknown> = { ...defaults };
  if (properties['workflow-definition'] !== undefined) values.workflow = workflowDefinitionCheck(restoreWorkflowNoteData(properties['workflow-definition']));
  if (properties['request-object-definition'] !== undefined) values.requestObject = requestObjectDefinitionCheck(properties['request-object-definition']);
  if (properties['herdr-agent'] !== undefined) values.herdrAgent = properties['herdr-agent'];
  for (const [key, property] of Object.entries(FIELDS)) if (properties[property] !== undefined) values[key] = properties[property];
  values.projectName = cleanLine(text({ min: 1, max: 80 })(values.projectName), 80);
  values.projectBrief = text({ max: 8000 })(cleanText(text({ max: 40000 })(values.projectBrief)));
  values.agentPrompt = text({ max: 8000 })(cleanText(text({ max: 40000 })(values.agentPrompt)));
  const prompts: NonNullable<Settings['stagePrompts']> = {};
  for (const stage of STAGES) { const value = properties[`agent-prompt-${stage}`]; if (value != null) prompts[stage] = text({ max: 8000 })(cleanText(text({ max: 40000 })(value), 8001)); }
  values.stagePrompts = normalizeStagePrompts(prompts);
  const agents: Record<string, unknown> = {};
  for (const stage of STAGES) {
    const provider = properties[`agent-provider-${stage}`]; const model = properties[`agent-model-${stage}`];
    const herdrAgent = properties[`agent-herdr-agent-${stage}`];
    if (provider !== undefined || model !== undefined || herdrAgent !== undefined) agents[stage] = { ...(provider === undefined ? {} : { provider }), ...(model === undefined ? {} : { model: agentModelCheck(cleanLine(text({ max: 500 })(model))) }), ...(herdrAgent === undefined ? {} : { herdrAgent }) };
  }
  values.stageAgents = normalizeStageAgents(stageAgentsCheck(agents));
  const automation: Record<string, unknown> = { ...defaults.automation };
  for (const stage of STAGES) if (properties[`automation-${stage}`] !== undefined) automation[stage] = properties[`automation-${stage}`];
  const settings: Settings = settingsCheck({ ...values, automation });
  settingsPatch(settings);
  return {
    id: projectId(properties.id), settings,
    ...(properties['coforge-feature-groups'] === undefined ? {} : { featureGroups: projectFeatureGroupsCheck(properties['coforge-feature-groups']) }),
    visibility: oneOf(['public', 'private'] as const)(properties['coforge-visibility'] === undefined ? 'public' : properties['coforge-visibility']),
    projectPath: validateProjectPath(properties['project-path'] ?? ''), worktreeFolder: validateProjectPath(properties['worktree-folder'] ?? ''),
    repositoryUrl: validateProjectUrl(properties['repository-url'] ?? '', true), websiteUrl: validateProjectUrl(properties['website-url'] ?? ''),
    allowImplementation: boolean(properties['allow-implementation'] ?? false),
    createdAt: noteTimestamp(properties.created), updatedAt: noteTimestamp(properties.updated),
  };
}

export const projectBody = (project: StudioProject): string => `# ${escapeMarkdown(project.settings.projectName)}\n\n## Notes\n\n`;
