import {
  computed,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
  type ComponentPublicInstance,
} from "vue";
import {
  sceneContext,
  type ObsSceneAction,
  type ObsSceneItem,
  type ObsSceneKind,
  type ObsSceneRemoval,
} from "../../../features/coforge/domain/obs-scenes";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
export function useObsSceneManager() {
  const { host } = useCoforge();
  const store = useStudioStore();
  const working = ref(false);
  const loading = ref(false);
  const error = ref("");
  const notice = ref("");
  const confirmation = ref<{ action: ObsSceneRemoval; text: string } | null>(null);
  const confirmationElement = ref<HTMLElement | null>(null);
  let previousFocus: HTMLElement | null = null;
  watch(confirmation, async (value) => {
    if (!value) return;
    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    await nextTick();
    confirmationElement.value?.focus();
    confirmationElement.value?.scrollIntoView({ block: "nearest" });
  });
  const example = computed(() =>
    store.studioExampleEnabled ? host.previewLiveStudio?.() : undefined,
  );
  const snapshot = computed(() => {
    void store.studioExampleRevision;
    return example.value?.snapshot() ?? store.state?.runtime.obs?.snapshot;
  });
  const connected = computed(
    () =>
      Boolean(example.value) ||
      store.state?.runtime.obs?.connection === "connected",
  );
  const uncertain = computed(() => {
    void store.studioExampleRevision;
    return (
      example.value?.uncertain() ?? store.state?.runtime.obs?.uncertain ?? false
    );
  });
  const busy = computed(
    () =>
      working.value ||
      (!example.value && Boolean(store.state?.runtime.obs?.busy)),
  );
  const actions = () => {
    const actions = example.value?.scenes ?? host.obsScenes;
    if (!actions)
      throw new Error("Scene controls are available in the Obsidian plugin.");
    return actions;
  };
  let revision = 0;
  let closed = false;
  let previousName = "";
  let previousScene = "";
  const detail = computed(() => store.obsEditorDetail);
  const currentContext = computed(() =>
    snapshot.value ? sceneContext(snapshot.value) : null,
  );
  const contextMatches = computed(() =>
    Boolean(
      detail.value &&
      currentContext.value &&
      detail.value.sceneId === store.obsEditorScene &&
      detail.value.context.epoch === currentContext.value.epoch &&
      detail.value.context.collection === currentContext.value.collection &&
      detail.value.context.revision === currentContext.value.revision,
    ),
  );
  const canMutate = computed(
    () =>
      connected.value &&
      contextMatches.value &&
      !busy.value &&
      !loading.value &&
      !uncertain.value &&
      !snapshot.value?.transitioning &&
      !snapshot.value?.reconnecting,
  );
  async function load() {
    if (closed || !connected.value || !store.obsEditorScene) return;
    const current = ++revision;
    loading.value = true;
    error.value = "";
    try {
      const value = await actions().inspect(store.obsEditorScene);
      if (closed || current !== revision) return;
      store.obsEditorDetail = value;
      if (
        previousScene !== value.sceneId ||
        store.obsRenameSceneName === previousName
      )
        store.obsRenameSceneName = value.name;
      if (previousScene !== value.sceneId || !store.obsCopySceneName)
        store.obsCopySceneName = value.name.slice(0, 123) + " copy";
      previousScene = value.sceneId;
      previousName = value.name;
      if (
        !value.sources.some(
          (source) =>
            source.id === store.obsExistingSource &&
            !value.items.some((item) => item.name === source.name),
        )
      )
        store.obsExistingSource = "";
    } catch (problem) {
      if (!closed && current === revision)
        error.value =
          problem instanceof Error
            ? problem.message
            : "Scene sources could not be read.";
    } finally {
      if (!closed && current === revision) loading.value = false;
    }
  }
  async function execute(action: ObsSceneAction, success: string) {
    working.value = true;
    error.value = "";
    notice.value = "";
    confirmation.value = null;
    try {
      const result = await store.mutate(() => actions().execute(action));
      if (closed) return;
      store.studioExampleRevision++;
      if (result.detail) {
        store.obsEditorScene = result.detail.sceneId;
        store.obsEditorDetail = result.detail;
      } else
        store.obsEditorScene =
          result.snapshot.programSceneId ?? result.snapshot.scenes[0]?.id ?? "";
      if (action.kind === "scene-create") store.obsNewSceneName = "";
      notice.value = success;
    } catch (problem) {
      if (!closed) {
        store.studioExampleRevision++;
        error.value =
          problem instanceof Error
            ? problem.message
            : "The scene action failed. Inspect OBS before retrying.";
      }
    } finally {
      if (!closed) working.value = false;
    }
  }
  watch(
    () =>
      `${store.obsEditorOpen}|${store.obsEditorScene}|${connected.value}|${currentContext.value?.epoch}|${currentContext.value?.collection}|${currentContext.value?.revision}|${busy.value}`,
    () => {
      if (!store.obsEditorOpen) return;
      if (!connected.value) {
        revision++;
        store.obsEditorDetail = null;
        confirmation.value = null;
        return;
      }
      if (busy.value) return;
      if (
        confirmation.value &&
        currentContext.value &&
        JSON.stringify(confirmation.value.action.expected) !==
          JSON.stringify(currentContext.value)
      ) {
        confirmation.value = null;
        error.value = "OBS changed. Review the target again before confirming.";
      }
      if (
        !snapshot.value?.scenes.some(
          (scene) => scene.id === store.obsEditorScene,
        )
      ) {
        store.obsEditorScene =
          snapshot.value?.programSceneId ?? snapshot.value?.scenes[0]?.id ?? "";
        return;
      }
      void load();
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    closed = true;
    revision++;
  });
  const expected = () => {
    if (!detail.value)
      throw new Error("Select and refresh an OBS scene first.");
    return detail.value.context;
  };
  const blockedDelete = computed(() => {
    const id = detail.value?.sceneId;
    if (!id) return "Select a scene.";
    if (snapshot.value?.scenes.length === 1)
      return "Keep at least one scene in OBS.";
    if (
      [snapshot.value?.programSceneId, snapshot.value?.previewSceneId].includes(
        id,
      )
    )
      return "Switch away from this program/preview scene before deleting it.";
    if (
      [
        store.state?.obsSettings?.liveSceneId,
        store.state?.obsSettings?.breakSceneId,
        store.state?.obsResumeSceneId,
      ].includes(id)
    )
      return "Choose replacement go-live/BRB assignments before deleting this scene.";
    return "";
  });
  return reactive({
    store,
    detail,
    snapshot,
    connected,
    uncertain,
    busy,
    loading,
    error,
    notice,
    confirmation,
    canMutate,
    blockedDelete,
    example: computed(() => Boolean(example.value)),
    supported: Boolean(host.obsScenes) || Boolean(host.previewLiveStudio),
    supports: (kind: ObsSceneKind) =>
      Boolean(detail.value?.available.includes(kind)),
    sources: computed(
      () =>
        detail.value?.sources.filter(
          (source) =>
            !detail.value!.items.some((item) => item.name === source.name),
        ) ?? [],
    ),
    nameConflict: (name: string) =>
      Boolean(
        snapshot.value?.scenes.some((scene) => scene.name === name.trim()) ||
        detail.value?.sources.some((source) => source.name === name.trim()),
      ),
    toggle: (event: Event) => {
      if (event.target instanceof HTMLDetailsElement)
        store.obsEditorOpen = event.target.open;
    },
    refresh: () => {
      void (async () => {
        error.value = "";
        confirmation.value = null;
        working.value = true;
        try {
          if (example.value) await example.value.refresh();
          else await host.obs?.refresh();
          store.studioExampleRevision++;
        } catch (problem) {
          error.value =
            problem instanceof Error
              ? problem.message
              : "OBS could not be refreshed.";
        } finally {
          working.value = false;
          await load();
        }
      })();
    },
    create: (event: Event) => {
      event.preventDefault();
      if (currentContext.value)
        void execute(
          {
            kind: "scene-create",
            name: store.obsNewSceneName,
            expected: currentContext.value,
          },
          "Scene created. Program output was not switched.",
        );
    },
    rename: (event: Event) => {
      event.preventDefault();
      void execute(
        {
          kind: "scene-rename",
          sceneId: store.obsEditorScene,
          name: store.obsRenameSceneName,
          expected: expected(),
        },
        "Scene renamed; saved assignments follow its identity.",
      );
    },
    duplicate: (event: Event) => {
      event.preventDefault();
      void execute(
        {
          kind: "scene-duplicate",
          sceneId: store.obsEditorScene,
          name: store.obsCopySceneName,
          expected: expected(),
        },
        "Scene copied with shared sources. Program output was not switched.",
      );
    },
    switch: () => {
      void execute(
        {
          kind: "scene-switch",
          sceneId: store.obsEditorScene,
          expected: expected(),
        },
        "OBS confirmed the new program scene.",
      );
    },
    visible: (item: ObsSceneItem) => {
      void execute(
        {
          kind: "item-visible",
          sceneId: store.obsEditorScene,
          itemId: item.id,
          enabled: !item.enabled,
          expected: expected(),
        },
        "Source visibility confirmed.",
      );
    },
    order: (item: ObsSceneItem, direction: "up" | "down") => {
      void execute(
        {
          kind: "item-order",
          sceneId: store.obsEditorScene,
          itemId: item.id,
          direction,
          expected: expected(),
        },
        "Source order confirmed.",
      );
    },
    add: (event: Event) => {
      event.preventDefault();
      void execute(
        {
          kind: "item-add",
          sceneId: store.obsEditorScene,
          sourceId: store.obsExistingSource,
          expected: expected(),
        },
        "Existing source added to this scene.",
      );
    },
    remove: (item: ObsSceneItem) => {
      confirmation.value = {
        action: {
          kind: "item-remove",
          sceneId: store.obsEditorScene,
          itemId: item.id,
          confirmed: true,
          confirmedName: item.name,
          expected: expected(),
        },
        text: `Remove “${item.name}” from “${detail.value?.name}”? Other scene references are not changed. OBS may discard a source with no remaining references.`,
      };
    },
    delete: () => {
      if (detail.value)
        confirmation.value = {
          action: {
            kind: "scene-delete",
            sceneId: detail.value.sceneId,
            confirmed: true,
            confirmedName: detail.value.name,
            expected: expected(),
          },
          text: `Delete scene “${detail.value.name}” and its memberships? OBS also removes references to this scene from other scenes. Shared input sources used elsewhere remain.`,
        };
    },
    bindConfirmation: (value: Element | ComponentPublicInstance | null) => {
      confirmationElement.value = value instanceof HTMLElement ? value : null;
    },
    cancel: () => {
      confirmation.value = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    },
    confirm: () => {
      if (confirmation.value)
        void execute(confirmation.value.action, "OBS confirmed the removal.");
    },
  });
}
