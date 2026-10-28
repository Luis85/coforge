import { computed, reactive, ref, shallowRef } from "vue";
import type { ContextMenuItem } from "@nuxt/ui";
import {
  STATUS_LABELS,
  type Idea,
} from "../../../features/coforge/domain/types";
import { ideaProjectId } from "../../../features/coforge/domain/projects";
import { isActiveJob } from "../../../features/coforge/domain/workflow";
import {
  ideaWorkflowAction,
  ideaWorkflowActionIdentity,
} from "./idea-workflow-action";
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
    if (open)
      reviewed.value = ideaWorkflowActionIdentity(props.idea, project.value);
  };
  const active = computed(() =>
    store.state?.jobs.some(
      (job) => job.ideaId === props.idea.id && isActiveJob(job),
    ),
  );
  const project = computed(() =>
    store.state?.projects?.find(
      (project) => project.id === ideaProjectId(props.idea),
    ),
  );
  const nextAction = computed(() =>
    ideaWorkflowAction(props.idea, project.value, store.state?.runtime),
  );
  const reason = computed(() =>
    store.busy || active.value
      ? "A request action is already queued or running."
      : (nextAction.value?.blocked ?? ""),
  );
  const openWorkflow = () => {
    const guard = store.configurationIssue("workflow");
    if (guard) {
      store.notify(guard, true);
      return;
    }
    store.workflowRequestSelection = props.idea.id;
    store.select(null);
    store.openWorkflowTool("runs");
  };
  const runStage = () => {
    const current = store.state?.ideas.find(
      (idea) => idea.id === props.idea.id,
    );
    if (
      !current ||
      ideaWorkflowActionIdentity(current, project.value) !== reviewed.value
    ) {
      store.notify(
        "This request or workflow changed. Reopen its action menu and review it again.",
        true,
      );
      return;
    }
    if (reason.value) {
      store.notify(reason.value, true);
      return;
    }
    if (nextAction.value?.kind === "open") {
      openWorkflow();
      return;
    }
    void actions.runWorkflowStep(current.id).then((ok) => {
      if (
        ok &&
        store.state?.ideas.find((idea) => idea.id === current.id)?.workflowRun
          ?.state === "waiting-human"
      )
        openWorkflow();
    });
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
    const action = nextAction.value;
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
    if (action)
      groups.push([
        { type: "label", label: "Configured workflow" },
        {
          label: action.label,
          description: reason.value || action.description,
          icon: action.kind === "open" ? "i-lucide-workflow" : "i-lucide-play",
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
          onSelect: openWorkflow,
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
