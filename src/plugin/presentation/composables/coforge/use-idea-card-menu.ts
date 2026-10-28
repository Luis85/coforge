import { computed, reactive, ref, shallowRef } from "vue";
import type { ContextMenuItem } from "@nuxt/ui";
import {
  STATUS_LABELS,
  type Idea,
} from "../../../features/coforge/domain/types";
import { workflowStageProblem } from "./workflow-readiness";
import { stageAgent } from "../../../features/coforge/domain/stage-agents";
import { ideaProjectId } from "../../../features/coforge/domain/projects";
import {
  assertStage,
  stageFor,
  isActiveJob,
} from "../../../features/coforge/domain/workflow";
import { ideaFingerprint } from "../../../features/coforge/domain/integrity";
import { useStudioStore } from "../../stores/coforge-studio";
import { useStudioActions } from "./use-studio-actions";
const elementNode = (value: unknown): value is HTMLElement =>
  Boolean(
    value &&
    typeof value === "object" &&
    Reflect.get(value, "nodeType") === 1 &&
    typeof Reflect.get(value, "closest") === "function" &&
    typeof Reflect.get(value, "focus") === "function",
  );
export function useIdeaCardMenu(
  props: { idea: Idea },
  card: { voted: boolean; voteDisabled: boolean; vote(): void },
) {
  const store = useStudioStore();
  const actions = useStudioActions();
  const reviewed = ref("");
  const portal = shallowRef<HTMLElement | false>(false);
  const contextOpen = ref(false);
  const dropdownOpen = ref(false);
  const changed = (kind: "context" | "dropdown", open: boolean) => {
    if (kind === "context") {
      contextOpen.value = open;
      if (open) dropdownOpen.value = false;
    } else {
      dropdownOpen.value = open;
      if (open) contextOpen.value = false;
    }
    if (open) reviewed.value = ideaFingerprint(props.idea);
  };
  const active = computed(() =>
    store.state?.jobs.some(
      (job) => job.ideaId === props.idea.id && isActiveJob(job),
    ),
  );
  const nextAgent = computed(() => {
    const stage = stageFor(props.idea);
    const state = store.state;
    const project = state?.projects?.find(
      (project) => project.id === ideaProjectId(props.idea),
    );
    if (!stage || !state || !project) return null;
    return stageAgent(
      project.id === state.activeProjectId ? state.settings : project.settings,
      stage,
    );
  });
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
    const state = store.state;
    const project = state?.projects?.find(
      (project) => project.id === ideaProjectId(props.idea),
    );
    if (!project || project.unavailable)
      return "Restore this project before dispatching work.";
    const settings =
      project.id === state?.activeProjectId ? state.settings : project.settings;
    return workflowStageProblem(settings, stage, project, store.state?.runtime);
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
        { type: "label", label: `${idea.id} · ${STATUS_LABELS[idea.status]}` },
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
          description:
            card.voteDisabled && !card.voted
              ? "Voting is unavailable while this request is flagged, archived or another action is pending."
              : undefined,
          onSelect: () => card.vote(),
        },
      ],
    ];
    if (stage)
      groups.push([
        { type: "label", label: "Next workflow step" },
        {
          label: {
            screen: "Screen request",
            score: "Review and score",
            plan: "Create implementation plan",
            implement: "Build planned request",
          }[stage],
          description:
            reason.value ||
            (nextAgent.value && nextAgent.value.provider !== "demo"
              ? `${nextAgent.value.provider === "herdr" ? "Herdr · Claude Code" : "Claude Code"} · ${nextAgent.value.model}`
              : "Simulation · no model calls"),
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
    portal,
    contextOpen,
    dropdownOpen,
    contextContent: computed(() => ({
      collisionBoundary: portal.value || undefined,
      collisionPadding: 12,
      avoidCollisions: true,
      "aria-label": `Actions for ${props.idea.id}`,
    })),
    dropdownContent: computed(() => ({
      collisionBoundary: portal.value || undefined,
      align: "end" as const,
      collisionPadding: 12,
      sideOffset: 6,
      avoidCollisions: true,
      "aria-label": `Actions for ${props.idea.id}`,
    })),
    bindCard: (value: unknown) => {
      if (!elementNode(value)) return;
      const scope = value.closest(".ps--coforge");
      portal.value = elementNode(scope) ? scope : false;
    },
    contextChanged: (open: boolean) => changed("context", open),
    dropdownChanged: (open: boolean) => changed("dropdown", open),
    keydown: (event: KeyboardEvent) => {
      if (
        event.key !== "ContextMenu" &&
        !(event.shiftKey && event.key === "F10")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      changed("context", true);
    },
  });
}
