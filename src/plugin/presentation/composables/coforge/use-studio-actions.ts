import type { ChatResult } from "../../../features/coforge/application/chat";
import type {
  AgentJob,
  Category,
  IdeaAction,
  IntegrationSettings,
  RiceScore,
  Settings,
} from "../../../features/coforge/domain/types";
import { STAGE_LABELS } from "../../../features/coforge/domain/types";
import { useCoforge } from "../../context/coforge-context";
import {
  useStudioStore,
  type IdeaDrawerTab,
} from "../../stores/coforge-studio";
import { ideaProjectId } from "../../../features/coforge/domain/projects";

const ACTION_MESSAGES: Partial<Record<IdeaAction, string>> = {
  approve:
    "Increment accepted. The contributor’s recognition has been updated.",
  reject: "Idea archived. Its history is preserved.",
  changes: "Changes requested. Your feedback is saved with the idea.",
  unflag: "Moderation decision saved.",
};

/**
 * Every studio request a view can make. Each resolves to `true` on success and `false` after showing
 * the failure as a toast, so templates can call them directly and forms can keep drafts on failure.
 */
export function useStudioActions() {
  const { studio, host } = useCoforge();
  const store = useStudioStore();
  const attempt = <T>(
    work: () => Promise<T>,
    success?: string | ((result: T) => string),
  ): Promise<boolean> =>
    store.mutate(work, success).then(
      () => true,
      () => false,
    );
  const selectProject = async (id: string): Promise<boolean> => {
    const problem = store.configurationIssue();
    if (problem) {
      store.notify(problem, true);
      return false;
    }
    const done = await attempt(() => studio.selectProject(id));
    if (done) {
      store.select(null);
      store.creating = false;
      store.navigate("board");
    }
    return done;
  };
  return {
    selectProject,
    createProject: (input: unknown) => {
      const problem = store.configurationIssue();
      if (problem) {
        store.notify(problem, true);
        return Promise.resolve(false);
      }
      return attempt(
        () => studio.createProject(input),
        "Project added. Its automation starts paused.",
      );
    },
    changeProject: (input: unknown, id?: string) =>
      attempt(() => studio.updateProject(input, id), "Project settings saved."),
    saveProjectDraft: (
      input: unknown,
      id: string,
      expectedConfiguration: string,
    ) =>
      store
        .mutate(
          () => studio.updateProject(input, id, expectedConfiguration),
          "Project settings saved.",
        )
        .catch(() => null),
    openIdea: async (id: string, tab: IdeaDrawerTab = "overview") => {
      const idea = store.state?.ideas.find((item) => item.id === id);
      if (
        idea &&
        ideaProjectId(idea) !== store.state?.activeProjectId &&
        !(await selectProject(ideaProjectId(idea)))
      )
        return false;
      store.select(id, tab);
      return true;
    },
    changeSettings: (patch: Partial<Settings>) =>
      attempt(() => studio.updateSettings(patch)),
    takeAction: (id: string, action: IdeaAction, note?: string) =>
      attempt(
        () => studio.act(id, action, note),
        ACTION_MESSAGES[action] ??
          `${STAGE_LABELS[action as keyof typeof STAGE_LABELS]} job queued.`,
      ),
    vote: (id: string) =>
      attempt(
        () => studio.vote(id),
        (result: ChatResult) => result.message,
      ),
    adjustRice: (id: string, value: Omit<RiceScore, "score">) =>
      attempt(() => studio.adjustRice(id, value), "RICE estimate updated."),
    runNext: () =>
      attempt(
        () => studio.runNext(),
        (job: AgentJob | null) =>
          job
            ? `${STAGE_LABELS[job.stage]} queued for ${job.ideaId}.`
            : "No eligible step right now. Check stage toggles, vote threshold, and active jobs.",
      ),
    startWorkflow: (id: string) =>
      attempt(
        () => studio.startWorkflow(id),
        "Workflow started with its saved definition.",
      ),
    runWorkflowStep: (id: string) =>
      attempt(() => studio.runWorkflowStep(id), "Workflow step requested."),
    stopWorkflow: (id: string) =>
      attempt(
        () => studio.stopWorkflow(id),
        "Workflow stop requested. Inspect any pending code changes or external agents.",
      ),
    cancelJob: (id: string) =>
      attempt(() => studio.cancel(id), "Cancellation requested."),
    sendChat: (username: string, text: string) =>
      attempt(async () => {
        const result = await studio.sendChat(username, text);
        if (!result.ok) throw new Error(result.message);
        return result;
      }),
    sendTwitch: (text: string) =>
      attempt(async () => {
        if (!host.twitch)
          throw new Error("Connect Twitch in the Obsidian plugin.");
        await host.twitch.send(text);
      }),
    simulate: () => attempt(() => studio.simulate()),
    createIdea: (data: {
      title: string;
      description: string;
      category: Category;
      username: string;
      requestKind?: "feature" | "bug";
    }) =>
      attempt(
        () => studio.createIdea(data),
        (outcome) => outcome.message,
      ),
    loadSample: async () => {
      const done = await attempt(
        () => studio.loadSample(),
        "Sample workspace restored. Automation is paused.",
      );
      if (done) store.select(null);
      return done;
    },
    exportProject: () =>
      attempt(
        () => host.saveExport(studio.exportJson()),
        (path) => `Project snapshot exported to ${path}.`,
      ),
    updateIntegration: (patch: Partial<IntegrationSettings>) =>
      attempt(
        () => studio.updateIntegration(patch),
        "Integration settings saved.",
      ),
    refreshRuntime: () =>
      attempt(
        () => studio.refreshRuntime(),
        (runtime) =>
          runtime.cliAvailable
            ? "Claude Code CLI is available."
            : "Claude Code CLI was not found or is too old.",
      ),
    setSecret: (name: string, value: string): boolean => {
      const saved = host.setSecret(name, value);
      if (saved) store.notify("Secret saved in Obsidian’s secret storage.");
      else
        store.notify(
          "This Obsidian version has no secret storage. Update Obsidian to store the Twitch token.",
          true,
        );
      return saved;
    },
    hasSecret: (name: string) => host.hasSecret(name),
    integration: () => studio.integration(),
    /** Resolve to a status line for the settings tab, or null after a failure toast. */
    publishBoard: () =>
      store
        .mutate(() => host.publishBoard())
        .then(
          (result) =>
            result.changed
              ? `Viewer board written to ${result.folder}. Commit and push the vault to publish it.`
              : `The viewer board in ${result.folder} is already up to date.`,
          () => null,
        ),
    installPagesWorkflow: () =>
      store
        .mutate(() => host.installPagesWorkflow())
        .then(
          (result) =>
            `${result.created ? "Created" : "Checked"} ${result.workflow} for ${result.folder}. Commit and push it, then set Settings › Pages › Source to GitHub Actions in the repository.`,
          () => null,
        ),
    openNote: (id: string) =>
      attempt(async () => {
        if (!(await host.openIdeaNote(id)))
          throw new Error(`The note for ${id} was not found.`);
      }),
  };
}
export type StudioActions = ReturnType<typeof useStudioActions>;
