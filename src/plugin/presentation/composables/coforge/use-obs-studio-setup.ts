import { computed, reactive, toRaw, watch } from "vue";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { useObsSetupUi } from "../../stores/obs-setup-ui";
import { useObsProduction } from "./use-obs-production";
import {
  OBS_SETUP_NAMES,
  OBS_SETUP_ROLES,
  type ObsSetupRole,
} from "../../../features/coforge/domain/obs-setup";
import { obsTextInputKind } from '../../../features/coforge/domain/obs-production';
export function useObsStudioSetup() {
  const { host } = useCoforge();
  const studio = useStudioStore();
  const ui = useObsSetupUi();
  const production = useObsProduction();
  const state = computed(() => studio.state?.obsSetup);
  const titleKind = computed(() => ['text_gdiplus_v3', 'text_gdiplus_v2', 'text_ft2_source_v2'].find(kind => obsTextInputKind(kind) && production.ui.snapshot?.inputKinds.includes(kind)));
  function port() {
    if (!host.obsSetup)
      throw new Error(
        "Create your studio inside the Obsidian plugin after connecting OBS.",
      );
    return host.obsSetup;
  }
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
          : "Studio creation could not finish. Inspect the saved progress before retrying.";
    } finally {
      ui.pending = false;
    }
  }
  function invalidate() {
    ui.preview = null;
    ui.confirmed = false;
  }
  watch(
    () => [
      ui.includeVideo,
      ui.includeOutputPreset,
      ui.includeTitles,
      JSON.stringify(production.ui.video),
      production.ui.outputPreset,
      production.ui.replayEnabled,
      production.ui.replaySeconds,
    ],
    invalidate,
  );
  return reactive({
    ui,
    production,
    state,
    roles: OBS_SETUP_ROLES,
    names: OBS_SETUP_NAMES,
    supported: Boolean(host.obsSetup),
    titleKind,
    titlesEnabled: computed({
      get: () => Boolean(titleKind.value) && ui.includeTitles,
      set: (value: boolean) => {
        ui.includeTitles = value;
      },
    }),
    created: computed(() => ui.created || state.value?.status === "confirmed"),
    openSources: () => {
      studio.broadcastTool = "sources";
    },
    invalidate,
    role: (role: ObsSetupRole, selected: boolean) => {
      ui.roles = selected
        ? [...new Set([...ui.roles, role])]
        : ui.roles.filter((value) => value !== role);
    },
    addSource: () => {
      if (!ui.sourceName.trim() || !ui.sourceKind || !ui.roles.length) {
        ui.error =
          "Name the source, choose an available source type and select at least one scene.";
        return;
      }
      ui.draft.sources.push({
        name: ui.sourceName.trim(),
        inputKind: ui.sourceKind,
        settings: ui.property && ui.value ? { [ui.property]: ui.value } : {},
        roles: [...ui.roles],
        enabled: ui.enabled,
      });
      ui.sourceName = "";
      ui.value = "";
      invalidate();
    },
    removeSource: (index: number) => {
      ui.draft.sources.splice(index, 1);
      invalidate();
    },
    preview: () =>
      run(async () => {
        const input = structuredClone(toRaw(ui.draft));
        if (ui.includeTitles && titleKind.value) {
          const titles: { role: ObsSetupRole; text: string }[] = [
            { role: "starting", text: "Starting soon" },
            { role: "brb", text: "Be right back" },
            { role: "ending", text: "Thanks for watching" },
          ];
          if (input.sources.length > 27)
            throw new Error(
              "Keep at most 27 authored sources when adding the three title slates.",
            );
          for (const title of titles) {
            const base = `${input.prefix ? input.prefix + " · " : ""}${OBS_SETUP_NAMES[title.role]} title`;
            let name = base;
            let suffix = 2;
            while (input.sources.some((source) => source.name === name))
              name = `${base} ${suffix++}`;
            input.sources.push({
              name,
              inputKind: titleKind.value,
              settings: { text: title.text },
              roles: [title.role],
              enabled: true,
            });
          }
        }
        ui.preview = await port().preview({
          ...input,
          ...(ui.includeVideo ? { video: { ...production.ui.video } } : {}),
          ...(ui.includeOutputPreset
            ? {
                outputPreset: {
                  preset: production.ui.outputPreset,
                  replayEnabled: production.ui.replayEnabled,
                  replaySeconds: production.ui.replaySeconds,
                },
              }
            : {}),
        });
        ui.confirmed = false;
      }, "Review the exact scenes and sources before creating them."),
    apply: () =>
      run(async () => {
        if (!ui.preview || !ui.confirmed)
          throw new Error("Review and confirm the studio preview first.");
        const firstSourceName = ui.preview.input.sources[0]?.name;
        const result = await port().apply({
          previewId: ui.preview.id,
          confirmed: true,
        });
        ui.created = true;
        ui.preview = null;
        ui.confirmed = false;
        await production.refresh();
        production.ui.selectedScene = result.liveSceneId;
        production.ui.selectedInput =
          production.ui.snapshot?.inputs.find(
            (source) => source.name === firstSourceName,
          )?.id ??
          production.ui.snapshot?.inputs[0]?.id ??
          "";
      }, "Studio created. Inspect captures and audio, configure output, then make a rehearsal recording before going live."),
    recover: () =>
      run(async () => {
        await port().recover();
      }, "Partial studio setup acknowledged. No creation steps were replayed."),
  });
}
