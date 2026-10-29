import type { StudioHostActions } from "../../../features/coforge/application/ports";
import type { ObsProductionActions } from "../../../features/coforge/application/obs-production-workflow";
import type { ObsProductionAction } from "../../../features/coforge/domain/obs-production";
import type { useObsProductionUi } from "../../stores/obs-production-ui";
import type { useStudioStore } from "../../stores/coforge-studio";
import { obsInputInitialProperty } from "./obs-input-label";
export type ObsUiAction = ObsProductionAction extends infer T
  ? T extends { expected: unknown }
    ? Omit<T, "expected">
    : never
  : never;
export function obsSourceActions(options: {
  ui: ReturnType<typeof useObsProductionUi>;
  studio: ReturnType<typeof useStudioStore>;
  host: Pick<StudioHostActions, "obsScenes">;
  port(): ObsProductionActions;
  run(work: () => Promise<void>, success?: string): Promise<boolean>;
  execute(action: ObsUiAction, success?: string): Promise<boolean>;
}) {
  const { ui, studio, host, port, run, execute } = options;
  function saveSettings(
    target:
      | { kind: "input-settings" }
      | { kind: "filter-settings"; filterName: string },
    key: string,
    value: string,
    type: "string" | "number" | "boolean",
  ) {
    if (
      (type === "number" &&
        (!value.trim() || !Number.isFinite(Number(value)))) ||
      (type === "boolean" && value !== "true" && value !== "false")
    ) {
      ui.error =
        type === "number"
          ? "Enter a finite numeric property value."
          : "Enter true or false for this Boolean property.";
      return Promise.resolve(false);
    }
    return execute({
      ...target,
      inputId: ui.selectedInput,
      settings: {
        [key]:
          type === "number"
            ? Number(value)
            : type === "boolean"
              ? value === "true"
              : value,
      },
    });
  }
  return {
    showScene: () =>
      run(async () => {
        if (!host.obsScenes || !ui.snapshot)
          throw new Error(
            "Refresh scene state before selecting the program scene.",
          );
        await host.obsScenes.execute({
          kind: "scene-switch",
          sceneId: ui.selectedScene,
          expected: { ...ui.snapshot.context },
        });
        ui.snapshot = await port().inspect();
      }, "OBS confirmed the selected program scene."),
    createSource: () =>
      run(async () => {
        if (!ui.snapshot) throw new Error("Refresh production state first.");
        const key = obsInputInitialProperty(ui.inputKind);
        ui.snapshot = await port().execute({
          kind: "input-create",
          expected: ui.snapshot.context,
          sceneId: ui.selectedScene,
          name: ui.sourceName,
          inputKind: ui.inputKind,
          settings: ui.sourceValue ? { [key]: ui.sourceValue } : {},
          enabled: ui.sourceEnabled,
        });
        ui.sourceName = "";
        ui.sourceValue = "";
      }, "Source created in the selected scene."),
    readProperties: () =>
      run(async () => {
        const id = ui.selectedInput;
        const property = ui.sourceProperty;
        const choices = await port().properties(id, property);
        if (id === ui.selectedInput && property === ui.sourceProperty)
          ui.sourceOptions = choices;
      }),
    saveProperty: () =>
      execute({
        kind: "input-settings",
        inputId: ui.selectedInput,
        settings: { [ui.sourceProperty]: ui.sourceOption },
      }),
    saveScalarProperty: () =>
      saveSettings(
        { kind: "input-settings" },
        ui.sourceProperty,
        ui.propertyValue,
        ui.propertyValueType,
      ),
    saveText: () =>
      execute({
        kind: "input-settings",
        inputId: ui.selectedInput,
        settings: { text: ui.sourceText },
      }),
    saveUrl: () => {
      if (
        !ui.sourceUrl.trim() ||
        /\[redacted\]|%5bredacted%5d/i.test(ui.sourceUrl)
      ) {
        ui.error =
          "Enter a complete replacement URL. Hidden credentials cannot be applied from a redacted value.";
        return Promise.resolve(false);
      }
      return execute({
        kind: "input-settings",
        inputId: ui.selectedInput,
        settings: { url: ui.sourceUrl },
      });
    },
    readTransform: () =>
      run(async () => {
        const sceneId = ui.selectedScene;
        const itemId = ui.itemId;
        if (!ui.snapshot)
          throw new Error("Refresh source state before reading a transform.");
        const context = { ...ui.snapshot.context };
        const transform = await port().transform(sceneId, itemId);
        if (sceneId === ui.selectedScene && itemId === ui.itemId) {
          ui.transform = transform;
          ui.transformRead = { sceneId, itemId, context };
        }
      }),
    readScene: () =>
      run(async () => {
        if (!host.obsScenes)
          throw new Error("Scene inspection is unavailable. Reconnect OBS.");
        const sceneId = ui.selectedScene;
        const detail = await host.obsScenes.inspect(sceneId);
        const frame = await port().frame(sceneId);
        if (sceneId !== ui.selectedScene) return;
        studio.obsEditorDetail = detail;
        ui.editorFrame = frame;
        ui.itemId = detail.items[0]?.id ?? 0;
        ui.transform = null;
      }),
    saveTransform: () =>
      run(async () => {
        const read = ui.transformRead;
        if (
          !read ||
          !ui.transform ||
          read.sceneId !== ui.selectedScene ||
          read.itemId !== ui.itemId ||
          !ui.snapshot ||
          read.context.epoch !== ui.snapshot.context.epoch ||
          read.context.collection !== ui.snapshot.context.collection ||
          read.context.revision !== ui.snapshot.context.revision
        )
          throw new Error(
            "Reload the selected item transform after OBS changes before applying a layout.",
          );
        ui.snapshot = await port().execute({
          kind: "item-transform",
          expected: { ...read.context },
          sceneId: read.sceneId,
          itemId: read.itemId,
          transform: { ...ui.transform },
        });
        ui.transformRead = null;
      }, "OBS confirmed the layout. Reload the item before another layout edit."),
    readFilters: () =>
      run(async () => {
        const id = ui.selectedInput;
        const filters = await port().filters(id);
        if (id === ui.selectedInput) ui.filters = filters;
      }),
    createFilter: () =>
      execute({
        kind: "filter-create",
        inputId: ui.selectedInput,
        filterName: ui.filterName,
        filterKind: ui.filterKind,
        settings: {},
      }),
    saveFilter: (name: string) =>
      saveSettings(
        { kind: "filter-settings", filterName: name },
        ui.filterSetting,
        ui.filterValue,
        ui.filterValueType,
      ),
  };
}
