import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  reactive,
  watch,
  type ComponentPublicInstance,
} from "vue";
import { coforgeKey } from "../../context/coforge-context";
import {
  useOutputTemplateStore,
  type ProjectOutputTemplateEditor,
} from "../../stores/coforge-output-templates";
import { workflowOutputTemplateInputCheck } from "../../../features/coforge/domain/workflow-output-templates";
import type { WorkflowOutputTemplate } from "../../../features/coforge/application/workflow-output-templates";

const dirty = (editor: ProjectOutputTemplateEditor) =>
  JSON.stringify(editor.draft) !== editor.saved;
type FocusKey = "summary" | "name" | "markdown" | "new" | "delete" | "keep";
type RefValue = Element | ComponentPublicInstance | null;
type FocusTarget = Element & { focus: () => void };
type LibraryElement = FocusTarget & { open: boolean };
const isFocusTarget = (value: RefValue): value is FocusTarget =>
  Boolean(
    value &&
    !("$el" in value) &&
    value.nodeType === 1 &&
    typeof Reflect.get(value, "focus") === "function",
  );
const isLibraryElement = (value: RefValue): value is LibraryElement =>
  isFocusTarget(value) &&
  value.tagName === "DETAILS" &&
  typeof Reflect.get(value, "open") === "boolean";
export const selectedOutputTemplate = (event: Event): string | undefined =>
  event.target instanceof HTMLSelectElement
    ? event.target.value || undefined
    : undefined;
function select(editor: ProjectOutputTemplateEditor, id: string) {
  const template = editor.templates.find((item) => item.id === id);
  editor.selectedId = template?.id ?? "";
  editor.draft = template
    ? { id: template.id, name: template.name, markdown: template.markdown }
    : null;
  editor.expectedRevision = template?.revision;
  editor.saved = JSON.stringify(editor.draft);
  editor.deleting = false;
}
/** Authoring never saves a workflow or dispatches an agent; each async result stays with its project. */
export function useWorkflowOutputTemplates(
  projectId: () => string,
  onChanged?: () => void,
) {
  const context = inject(coforgeKey, null);
  const actions = context?.host.outputTemplates;
  const store = useOutputTemplateStore();
  const editor = computed(() => store.editor(projectId()));
  const busy = computed(() => editor.value.loading || editor.value.working);
  let library: LibraryElement | undefined;
  let generation = 0;
  const focusTargets: Partial<Record<FocusKey, FocusTarget>> = {};
  function captureFocus() {
    return {
      project: projectId(),
      generation,
      library,
      origin: library?.ownerDocument.activeElement,
    };
  }
  function focus(key: FocusKey, scope = captureFocus()) {
    void nextTick().then(() => {
      if (
        !scope.library ||
        scope.library !== library ||
        scope.project !== projectId() ||
        scope.generation !== generation
      )
        return;
      const owner = scope.library;
      const document = owner.ownerDocument;
      if (
        document.activeElement !== scope.origin &&
        document.activeElement !== document.body
      )
        return;
      const target =
        key === "summary" ? owner.querySelector("summary") : focusTargets[key];
      if (target?.isConnected && owner.contains(target)) target.focus();
    });
  }
  function bindTarget(key: FocusKey, value: RefValue) {
    if (isFocusTarget(value)) focusTargets[key] = value;
    else delete focusTargets[key];
  }
  onBeforeUnmount(() => {
    generation++;
    library = undefined;
  });
  watch(
    () => store.libraryRequests[projectId()] ?? 0,
    (request) => {
      if (!request || !library) return;
      library.open = true;
      library.scrollIntoView({ block: "start", inline: "nearest" });
      focus("summary");
    },
  );
  async function refresh() {
    const id = projectId();
    const current = store.editor(id);
    if (!id || !actions || current.loading || current.working) return;
    current.loading = true;
    current.error = "";
    try {
      const result = await actions.list(id);
      const previous = JSON.stringify(current.templates);
      current.templates = result.templates;
      current.invalid = result.invalid;
      current.loaded = true;
      if (previous !== JSON.stringify(current.templates) && id === projectId())
        onChanged?.();
      if (!dirty(current)) select(current, current.selectedId);
      else
        current.notice =
          "Templates refreshed. Your unsaved template draft is kept.";
    } catch (cause) {
      current.error =
        cause instanceof Error
          ? cause.message
          : "Templates could not be loaded. Refresh to try again.";
    } finally {
      current.loading = false;
    }
  }
  async function perform(
    work: (id: string, current: ProjectOutputTemplateEditor) => Promise<void>,
    completionFocus?: FocusKey,
  ) {
    const id = projectId();
    const current = store.editor(id);
    if (!id || !actions || current.loading || current.working) return;
    const scope = captureFocus();
    let succeeded = false;
    current.working = true;
    current.error = "";
    current.notice = "";
    try {
      await work(id, current);
      succeeded = true;
    } catch (cause) {
      current.error =
        cause instanceof Error
          ? cause.message
          : "The template action failed. Your draft is kept.";
    } finally {
      current.working = false;
      if (succeeded && completionFocus) focus(completionFocus, scope);
    }
  }
  function update(
    current: ProjectOutputTemplateEditor,
    template: WorkflowOutputTemplate,
  ) {
    current.templates = [
      ...current.templates.filter((item) => item.id !== template.id),
      template,
    ].sort((a, b) => a.name.localeCompare(b.name));
    select(current, template.id);
  }
  watch(
    projectId,
    () => {
      generation++;
      if (!editor.value.loaded) void refresh();
    },
    { immediate: true },
  );
  return reactive({
    editor,
    available: Boolean(actions),
    bindLibrary: (value: RefValue) => {
      library = isLibraryElement(value) ? value : undefined;
    },
    bindName: (value: RefValue) => bindTarget("name", value),
    bindMarkdown: (value: RefValue) => bindTarget("markdown", value),
    bindNew: (value: RefValue) => bindTarget("new", value),
    bindDelete: (value: RefValue) => bindTarget("delete", value),
    bindKeep: (value: RefValue) => bindTarget("keep", value),
    manage: () => {
      store.requestLibrary(projectId());
    },
    busy,
    dirty: computed(() => dirty(editor.value)),
    canSave: computed(() =>
      Boolean(
        editor.value.draft?.name.trim() &&
        editor.value.draft.markdown.trim() &&
        dirty(editor.value) &&
        !busy.value,
      ),
    ),
    selected: computed(() =>
      editor.value.templates.find(
        (item) => item.id === editor.value.selectedId,
      ),
    ),
    refresh: () => {
      void refresh();
    },
    sourceChanged: computed(() =>
      Boolean(
        editor.value.expectedRevision &&
        editor.value.templates.find(
          (item) => item.id === editor.value.selectedId,
        )?.revision !== editor.value.expectedRevision,
      ),
    ),
    copyDraft: () => {
      const current = editor.value;
      if (!current.draft) return;
      if (!navigator.clipboard?.writeText) {
        current.error =
          "Clipboard is unavailable. Select and copy the Template Markdown field before discarding changes.";
        return;
      }
      void navigator.clipboard.writeText(current.draft.markdown).then(
        () => {
          current.notice =
            "Template Markdown copied. Discard template changes to load the saved version, then paste the parts you want to keep and save.";
        },
        () => {
          current.error =
            "The draft could not be copied. Select and copy the Template Markdown field before discarding changes.";
        },
      );
    },
    choose: (event: Event) => {
      if (
        dirty(editor.value) ||
        busy.value ||
        !(event.target instanceof HTMLSelectElement)
      )
        return;
      select(editor.value, event.target.value);
      editor.value.error = "";
      editor.value.notice = "";
    },
    create: () => {
      if (dirty(editor.value) || busy.value) return;
      const scope = captureFocus();
      select(editor.value, "");
      editor.value.draft = { name: "", markdown: "" };
      editor.value.error = "";
      editor.value.notice = "";
      focus("name", scope);
    },
    discard: () => {
      const scope = captureFocus();
      select(editor.value, editor.value.selectedId);
      editor.value.error = "";
      editor.value.notice = "";
      focus(editor.value.draft ? "markdown" : "new", scope);
    },
    save: () => {
      void perform(async (id, current) => {
        if (!current.draft || !actions) return;
        const input = workflowOutputTemplateInputCheck(current.draft);
        update(
          current,
          await actions.save(id, input, current.expectedRevision),
        );
        current.notice =
          "Template saved. New runs capture this version; existing runs keep their original content.";
        if (id === projectId()) onChanged?.();
      }, "markdown");
    },
    open: () => {
      void perform(async (id, current) => {
        if (current.selectedId) await actions?.open(id, current.selectedId);
      });
    },
    remove: () => {
      void perform(async (id, current) => {
        if (
          !current.deleting ||
          dirty(current) ||
          !current.selectedId ||
          !current.expectedRevision
        )
          return;
        await actions?.remove(id, current.selectedId, current.expectedRevision);
        current.templates = current.templates.filter(
          (item) => item.id !== current.selectedId,
        );
        select(current, "");
        current.notice =
          "Template deleted. Obsidian used your file deletion preference. Existing run snapshots are preserved. Clear or replace its selection in future workflows.";
        if (id === projectId()) onChanged?.();
      }, "new");
    },
    requestDelete: () => {
      if (dirty(editor.value) || busy.value) return;
      const scope = captureFocus();
      editor.value.deleting = true;
      focus("keep", scope);
    },
    cancelDelete: () => {
      const scope = captureFocus();
      editor.value.deleting = false;
      focus("delete", scope);
    },
  });
}
