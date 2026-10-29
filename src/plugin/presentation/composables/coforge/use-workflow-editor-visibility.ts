import { nextTick, onBeforeUnmount, type Ref } from "vue";
const element = (value: unknown): value is HTMLElement =>
  Boolean(
    value &&
    typeof value === "object" &&
    Reflect.get(value, "nodeType") === 1 &&
    typeof Reflect.get(value, "focus") === "function",
  );
/** DOM resources follow the editor lifetime; offscreen selection reveals the form without a page-top jump. */
export function useWorkflowEditorVisibility(selectedId: Ref<string>) {
  let editor: HTMLElement | undefined;
  let list: HTMLElement | undefined;
  let closed = false;
  onBeforeUnmount(() => {
    closed = true;
    editor = undefined;
    list = undefined;
  });
  const rowButton = (id: string) =>
    [
      ...(list?.querySelectorAll<HTMLElement>(".cf-workflow-step-select") ??
        []),
    ].find((button) => button.closest("li")?.dataset.stepId === id);
  const reveal = () => {
    void nextTick().then(() => {
      if (closed || !editor) return;
      const field = editor.querySelector<HTMLElement>(
        "input, textarea, select",
      );
      if (!field) return;
      const rect = field.getBoundingClientRect();
      const pane = editor.closest(".cf-content")?.getBoundingClientRect();
      const viewportHeight = editor.ownerDocument.defaultView?.innerHeight ?? 0;
      const top = Math.max(0, pane?.top ?? 0);
      const bottom = Math.min(viewportHeight, pane?.bottom ?? viewportHeight);
      if (rect.top < top + 8 || rect.bottom > bottom - 8) {
        field.scrollIntoView({ block: "center", inline: "nearest" });
        field.focus({ preventScroll: true });
      }
    });
  };
  return {
    bindStepEditor: (value: unknown) => {
      editor = element(value) ? value : undefined;
    },
    bindStepList: (value: unknown) => {
      list = element(value) ? value : undefined;
    },
    reveal,
    revealIssue: (field: string, workflow = false) => {
      void nextTick().then(() => {
        if (closed || !editor) return;
        const root = workflow ? editor.closest("form") : editor;
        if (!root) return;
        const target =
          [...root.querySelectorAll<HTMLElement>("[data-workflow-field]")].find(
            (item) => item.dataset.workflowField === field,
          ) ??
          root.querySelector<HTMLElement>(
            "input:invalid, select:invalid, textarea:invalid",
          ) ??
          root.querySelector<HTMLElement>("input, select, textarea");
        if (!target) return;
        let ancestor = target.closest("details");
        while (ancestor && root.contains(ancestor)) {
          ancestor.open = true;
          ancestor = ancestor.parentElement?.closest("details") ?? null;
        }
        target.scrollIntoView({ block: "center", inline: "nearest" });
        target.focus({ preventScroll: true });
      });
    },
    showStepList: () => {
      list?.scrollIntoView({ block: "nearest", inline: "nearest" });
      rowButton(selectedId.value)?.focus();
    },
    retainMoveFocus: (id: string, work: () => void) => {
      const focused = list?.ownerDocument.activeElement;
      const retained =
        element(focused) && list?.contains(focused) ? focused : undefined;
      work();
      void nextTick().then(() => {
        if (closed || !retained) return;
        const target =
          retained.isConnected && !retained.matches(":disabled")
            ? retained
            : rowButton(id);
        target?.focus({ preventScroll: true });
      });
    },
  };
}
