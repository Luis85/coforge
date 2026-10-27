import { computed, reactive, ref } from "vue";
import type { ContextMenuItem } from "@nuxt/ui";
import type { Idea } from "../../../features/coforge/domain/types";
import {
  assertStage,
  stageFor,
  isActiveJob,
} from "../../../features/coforge/domain/workflow";
import { ideaFingerprint } from "../../../features/coforge/domain/integrity";
import { useStudioStore } from "../../stores/coforge-studio";
import { useStudioActions } from "./use-studio-actions";
export function useIdeaCardMenu(
  props: { idea: Idea },
  card: { voted: boolean; voteDisabled: boolean; vote(): void },
) {
  const store = useStudioStore();
  const actions = useStudioActions();
  const reviewed = ref("");
  const active = computed(() =>
    store.state?.jobs.some(
      (job) => job.ideaId === props.idea.id && isActiveJob(job),
    ),
  );
  const reason = computed(() => {
    if (store.busy || active.value)
      return "A request action is already queued or running.";
    const stage = stageFor(props.idea);
    if (!stage) return "";
    try {
      assertStage(props.idea, stage);
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "Required evidence is missing.";
    }
    const project = store.state?.projects?.find(
      (project) => project.id === props.idea.projectId,
    );
    if (!project || project.unavailable)
      return "Restore this project before dispatching work.";
    if (project.settings.provider === "claude") {
      if (!store.state?.runtime.cliAvailable)
        return "Install/connect Claude Code in project settings.";
      if (["plan", "implement"].includes(stage) && !project.projectPath)
        return "Set the project directory first.";
      if (stage === "implement" && !project.allowImplementation)
        return "Real implementation is disabled for this project.";
    }
    return "";
  });
  const runStage = () => {
    const current = store.state?.ideas.find(
      (idea) => idea.id === props.idea.id,
    );
    const stage = current && stageFor(current);
    if (!current || !stage || ideaFingerprint(current) !== reviewed.value) {
      store.notify(
        "This request changed. Reopen its action menu and review it again.",
        true,
      );
      return;
    }
    if (reason.value) {
      store.notify(reason.value, true);
      return;
    }
    void actions.takeAction(current.id, stage);
  };
  const copy = (text: string) => {
    if (!navigator.clipboard?.writeText) {
      store.notify(`Copy manually: ${text}`);
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => store.notify("Request reference copied."),
      () => store.notify(`Copy manually: ${text}`),
    );
  };
  const items = computed<ContextMenuItem[][]>(() => {
    const idea = props.idea;
    const stage = stageFor(idea);
    const groups: ContextMenuItem[][] = [
      [
        {
          label: `Open ${idea.id}`,
          icon: "i-lucide-panel-right",
          onSelect: () => {
            void actions.openIdea(idea.id);
          },
        },
        {
          label: "Copy request ID",
          icon: "i-lucide-copy",
          onSelect: () => copy(idea.id),
        },
        {
          label: "Copy context command",
          icon: "i-lucide-message-square-plus",
          disabled: ["shipped", "rejected"].includes(idea.status),
          description: ["shipped", "rejected"].includes(idea.status)
            ? "This request is closed. Submit a new feature or bug instead."
            : undefined,
          onSelect: () => copy(`!context ${idea.id} `),
        },
        {
          label: card.voted ? "Vote already counted" : "Vote for request",
          icon: "i-lucide-arrow-up",
          disabled: card.voteDisabled,
          onSelect: () => card.vote(),
        },
      ],
    ];
    if (stage)
      groups.push([
        {
          label: {
            screen: "Screen request",
            score: "Review and score",
            plan: "Create implementation plan",
            implement: "Build planned request",
          }[stage],
          description:
            reason.value || "Run the next eligible stage for this request.",
          icon: "i-lucide-play",
          disabled: Boolean(reason.value),
          onSelect: runStage,
        },
      ]);
    if (idea.status === "review" || idea.status === "shipped")
      groups.push([
        {
          label: "Review increment",
          icon: "i-lucide-clipboard-check",
          onSelect: () => {
            void actions.openIdea(idea.id, "increment");
          },
        },
      ]);
    if (idea.status === "flagged")
      groups.push([
        {
          label: "Review screening decision",
          icon: "i-lucide-shield-check",
          onSelect: () => {
            void actions.openIdea(idea.id);
          },
        },
      ]);
    if (!["shipped", "rejected"].includes(idea.status))
      groups.push([
        {
          label: "Review / archive request…",
          icon: "i-lucide-archive",
          disabled: Boolean(active.value),
          description: active.value
            ? "Finish or cancel its active task first."
            : "Review the request before using Archive in its details.",
          onSelect: () => {
            void actions.openIdea(idea.id);
          },
        },
      ]);
    if (active.value)
      groups.push([
        {
          label: "Open agent workflow",
          icon: "i-lucide-workflow",
          onSelect: () => store.navigate("workflow"),
        },
      ]);
    return groups;
  });
  return reactive({
    items,
    openChanged: (open: boolean) => {
      if (open) reviewed.value = ideaFingerprint(props.idea);
    },
  });
}
