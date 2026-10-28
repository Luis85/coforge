import type {
  AgentStage,
  Provider,
  Settings,
  StudioProject,
} from "../../../features/coforge/domain/types";
import { STAGES, STAGE_LABELS } from "../../../features/coforge/domain/types";
import type { ProjectPaths } from "../../../features/coforge/domain/projects";
import {
  validateProjectPath,
  validateProjectUrl,
} from "../../../features/coforge/domain/project-note";
import { MODEL_PATTERN } from "../../../features/coforge/domain/stage-agents";
import { resolvedStagePrompts } from "../../../features/coforge/domain/stage-prompts";
import {
  stageAgentDrafts,
  type StageAgentDrafts,
} from "../../stores/coforge-stage-agent-draft";
/** The studio settings the form edits. Automation switches and pause live on other screens. */
type ProjectLinks = Pick<StudioProject, "repositoryUrl" | "websiteUrl">;
export type SettingsDraft = Pick<
  Settings,
  | "projectName"
  | "projectBrief"
  | "agentPrompt"
  | "provider"
  | "model"
  | NumberKey
> &
  ProjectPaths &
  ProjectLinks & {
    stagePrompts: Record<AgentStage, string>;
    stageAgents: StageAgentDrafts;
  };
type NumberKey =
  | "intervalSeconds"
  | "minVotes"
  | "requestCooldownSeconds"
  | "maxTurns"
  | "maxBudgetUsd"
  | "timeoutSeconds";
interface NumberField {
  key: NumberKey;
  label: string;
  min: number;
  max: number;
  step: number;
  integer: boolean;
  help?: string;
}

/** Mirrors `settingsPatch` in domain/inputs.ts so the form explains a rejection before it is sent. */
export const RHYTHM: NumberField[] = [
  {
    key: "intervalSeconds",
    label: "Queue interval · seconds",
    min: 2,
    max: 3600,
    step: 1,
    integer: true,
    help: "How often automatic dispatch checks for work.",
  },
  {
    key: "minVotes",
    label: "Votes before planning",
    min: 0,
    max: 10000,
    step: 1,
    integer: true,
    help: "Minimum demand for automatic planning.",
  },
];
export const LIMITS: NumberField[] = [
  {
    key: "maxTurns",
    label: "Maximum agent turns",
    min: 1,
    max: 50,
    step: 1,
    integer: true,
  },
  {
    key: "maxBudgetUsd",
    label: "Budget cap per run · USD",
    min: 0.1,
    max: 20,
    step: 0.01,
    integer: false,
  },
  {
    key: "timeoutSeconds",
    label: "Timeout · seconds",
    min: 15,
    max: 1800,
    step: 1,
    integer: true,
  },
];
export const PROVIDERS: Array<{
  value: Provider;
  icon: string;
  title: string;
  text: string;
}> = [
  {
    value: "demo",
    icon: "flask-conical",
    title: "Simulation",
    text: "Illustrative agent results. No CLI or credentials needed.",
  },
  {
    value: "claude",
    icon: "bot",
    title: "Claude Code CLI",
    text: "Real local agent runs using your configured Claude account.",
  },
];

export const pickSettingsDraft = (
  settings: Settings,
): Omit<SettingsDraft, keyof ProjectPaths | keyof ProjectLinks> => ({
  agentPrompt: settings.agentPrompt,
  stagePrompts: resolvedStagePrompts(settings.stagePrompts),
  stageAgents: stageAgentDrafts(settings.stageAgents),
  projectName: settings.projectName,
  projectBrief: settings.projectBrief,
  provider: settings.provider,
  model: settings.model,
  intervalSeconds: settings.intervalSeconds,
  minVotes: settings.minVotes,
  requestCooldownSeconds: settings.requestCooldownSeconds,
  maxTurns: settings.maxTurns,
  maxBudgetUsd: settings.maxBudgetUsd,
  timeoutSeconds: settings.timeoutSeconds,
});

function invalidNumber(draft: SettingsDraft): string | null {
  for (const field of [...RHYTHM, ...LIMITS]) {
    const value: unknown = draft[field.key];
    const valid =
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= field.min &&
      value <= field.max &&
      (!field.integer || Number.isInteger(value));
    if (!valid)
      return `${field.label.split(" · ")[0] ?? field.label} must be ${field.integer ? "a whole number" : "a number"} from ${field.min} to ${field.max}.`;
  }
  return null;
}

export function validateSettingsDraft(draft: SettingsDraft): string | null {
  try {
    validateProjectPath(draft.projectPath);
    validateProjectPath(draft.worktreeFolder);
    validateProjectUrl(draft.repositoryUrl, true);
    validateProjectUrl(draft.websiteUrl);
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Use absolute project paths.";
  }
  if (draft.allowImplementation && !draft.projectPath)
    return "Set the project repository before allowing real implementation.";
  if (
    !draft.projectName.trim() ||
    draft.projectBrief.trim().length < 10 ||
    !draft.model.trim()
  )
    return "Add a project name, a brief of at least 10 characters, and a Claude model.";
  if (!MODEL_PATTERN.test(draft.model.trim()))
    return "Use a model name or alias containing letters, numbers, dots, dashes, underscores, or colons.";
  for (const stage of STAGES)
    if (
      draft.stageAgents[stage].model.trim() &&
      !MODEL_PATTERN.test(draft.stageAgents[stage].model.trim())
    )
      return `${STAGE_LABELS[stage]} model must start with a letter or number and use at most 100 letters, numbers, dots, dashes, underscores or colons. Clear it to inherit the project default.`;
  return invalidNumber(draft);
}
