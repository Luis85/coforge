import { computed, nextTick, reactive, watch } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { useObsOverlayUi } from "../../stores/obs-overlay-ui";
import type { ObsOverlayDefinition } from "../../../features/coforge/domain/obs-overlay";
export function useObsOverlays() {
  const { host } = useCoforge();
  const studio = useStudioStore();
  const ui = useObsOverlayUi();
  function port() {
    if (!host.obsOverlays)
      throw new Error(
        "Public text overlays are available inside the Obsidian plugin.",
      );
    return host.obsOverlays;
  }
  function invalidate() {
    ui.preview = null;
    ui.reviewed = false;
    ui.dirty = true;
  }
  watch(
    () => [
      ui.name,
      ui.kind,
      ui.projectId,
      ui.inputId,
      ui.subjectId,
      ui.excerpt,
      ui.publicConfirmed,
    ],
    invalidate,
  );
  watch(
    () => ui.projectId,
    () => {
      ui.choices.requests = [];
      ui.choices.increments = [];
      ui.choices.recognition = [];
      ui.subjectId = "";
    },
  );
  watch(
    () => ui.kind,
    () => {
      ui.subjectId = "";
    },
  );
  async function run(work: () => Promise<void>, success = "") {
    if (ui.pending) return;
    ui.pending = true;
    ui.error = "";
    ui.notice = "";
    try {
      await work();
      ui.notice = success;
    } catch (error) {
      ui.error =
        error instanceof Error
          ? error.message
          : "The public overlay action failed. Review the current OBS text before retrying.";
    } finally {
      ui.pending = false;
    }
  }
  function definition(): ObsOverlayDefinition {
    return {
      id: ui.id,
      name: ui.name,
      kind: ui.kind,
      projectId: ui.projectId,
      inputId: ui.inputId,
      publicConfirmed: ui.publicConfirmed,
      ...(ui.kind === "request" ||
      ui.kind === "increment" ||
      ui.kind === "recognition"
        ? { subjectId: ui.subjectId }
        : {}),
      ...(ui.kind === "council-excerpt" ? { excerpt: ui.excerpt } : {}),
    };
  }
  async function reset() {
    ui.id = crypto.randomUUID();
    ui.name = "";
    ui.projectId = "";
    ui.inputId = "";
    ui.subjectId = "";
    ui.excerpt = "";
    ui.publicConfirmed = false;
    ui.preview = null;
    ui.reviewed = false;
    await nextTick();
    ui.dirty = false;
  }
  return reactive({
    ui,
    supported: Boolean(host.obsOverlays),
    connected: computed(
      () => studio.state?.runtime.obs?.connection === "connected",
    ),
    saved: computed(() => studio.state?.obsShow?.overlays ?? []),
    revocationNeeded: computed(
      () =>
        studio.state?.obsShow?.overlays?.some(
          (overlay) =>
            overlay.publication?.status === "revocation-required" ||
            overlay.publication?.status === "uncertain",
        ) ?? false,
    ),
    candidates: computed(() =>
      ui.kind === "request"
        ? ui.choices.requests
        : ui.kind === "increment"
          ? ui.choices.increments
          : ui.kind === "recognition"
            ? ui.choices.recognition
            : [],
    ),
    needsSubject: computed(
      () =>
        ui.kind === "request" ||
        ui.kind === "increment" ||
        ui.kind === "recognition",
    ),
    inventory: () =>
      run(async () => {
        ui.choices = await port().candidates(ui.projectId);
      }, "Public choices loaded. Select the exact content and text source."),
    preview: () =>
      run(async () => {
        ui.preview = await port().preview(definition());
        ui.reviewed = false;
      }, "Review the exact outgoing text and its target before publishing."),
    publish: () =>
      run(async () => {
        if (!ui.preview || !ui.reviewed || !ui.publicConfirmed)
          throw new Error(
            "Review the captured public text and confirm its exact OBS target first.",
          );
        await port().publish({ previewId: ui.preview.id, confirmed: true });
        ui.preview = null;
        ui.reviewed = false;
        ui.dirty = false;
      }, "OBS confirmed the public text update and the overlay mapping was saved."),
    refresh: (id: string) =>
      run(
        () => port().refreshOverlay(id),
        "Public overlay refreshed from its approved mapping.",
      ),
    clear: (id: string) =>
      run(
        () => port().clear(id),
        "CoForge-owned overlay text cleared. Past broadcast video is unchanged.",
      ),
    remove: (id: string) =>
      run(
        () => port().remove(id),
        "CoForge-owned text cleared and its overlay mapping removed.",
      ),
    reset,
    load: async () => {
      if (ui.dirty) {
        ui.error =
          "Discard the current overlay draft before loading another saved mapping.";
        return;
      }
      const value = studio.state?.obsShow?.overlays?.find(
        (item) => item.id === ui.selection,
      );
      if (!value) return;
      ui.id = value.id;
      ui.name = value.name;
      ui.kind = value.kind;
      ui.projectId = value.projectId;
      ui.inputId = value.inputId;
      await nextTick();
      ui.subjectId = value.subjectId ?? "";
      ui.excerpt = value.excerpt ?? "";
      ui.publicConfirmed = false;
      ui.preview = null;
    },
  });
}
