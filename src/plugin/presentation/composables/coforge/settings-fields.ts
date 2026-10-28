import type {
  Provider,
  Settings,
  StudioProject,
} from "../../../features/coforge/domain/types";
import type { ProjectPaths } from "../../../features/coforge/domain/projects";
import {
  validateProjectPath,
  validateProjectUrl,
} from "../../../features/coforge/domain/project-note";
type ProjectLinks = Pick<StudioProject, "repositoryUrl" | "websiteUrl">;
export type SettingsDraft = Pick<
  Settings,
  "projectName" | "projectBrief" | "agentPrompt"
> &
  ProjectPaths &
  ProjectLinks;
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
  {
    value: "herdr",
    icon: "network",
    title: "Herdr",
    text: "Dedicated Claude Code agent per task, launched with the selected model.",
  },
];

export const pickSettingsDraft = (
  settings: Settings,
): Pick<SettingsDraft, "projectName" | "projectBrief" | "agentPrompt"> => ({
  projectName: settings.projectName,
  projectBrief: settings.projectBrief,
  agentPrompt: settings.agentPrompt,
});
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
  if (!draft.projectName.trim() || draft.projectBrief.trim().length < 10)
    return "Add a project name and a brief of at least 10 characters.";
  return null;
}
