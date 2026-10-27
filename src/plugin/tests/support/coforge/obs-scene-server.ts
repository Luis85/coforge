import type { ObsSnapshot } from "../../../features/coforge/domain/obs";
import type {
  ObsSceneRequest,
  ObsSceneRpc,
} from "../../../infrastructure/coforge/obs-scenes-data";
import { IntegrationFailure } from "../../../features/coforge/domain/integration-failure";
interface Source {
  id: string;
  name: string;
  kind: "input" | "scene" | "group";
}
interface Item {
  id: number;
  source: Source;
  enabled: boolean;
  locked: boolean;
  index: number;
  blend: string;
  transform: Record<string, number>;
}
interface Scene extends Source {
  items: Item[];
  transition: {
    transitionName: string | null;
    transitionDuration: number | null;
  };
}
const text = (value: unknown) => {
  if (typeof value !== "string")
    throw new IntegrationFailure("delivery", "Invalid example name");
  return value;
};
const integer = (value: unknown) => {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new IntegrationFailure("delivery", "Invalid example item");
  return value;
};

/** Pure in-memory v5-shaped server for tests and explicit browser examples. Never connected to OBS. */
export class ObsSceneServer implements ObsSceneRpc {
  readonly requests: Array<{
    type: ObsSceneRequest;
    data: Record<string, unknown>;
  }> = [];
  version = 0;
  collection = 0;
  epoch = 1;
  ignoreVisibility = false;
  failDuplicateAt = 0;
  programId = "scene-game";
  active = true;
  private nextId = 10;
  private duplicates = 0;
  readonly inputs: Source[] = [
    { id: "input-game", name: "Example game capture", kind: "input" },
    { id: "input-camera", name: "Example camera", kind: "input" },
    { id: "input-overlay", name: "Example overlay", kind: "input" },
  ];
  readonly groups: Scene[] = [
    {
      id: "group-widgets",
      name: "Example widgets",
      kind: "group",
      items: [],
      transition: { transitionName: null, transitionDuration: null },
    },
  ];
  readonly scenes: Scene[] = [
    {
      id: "scene-game",
      name: "Example gameplay",
      kind: "scene",
      items: [],
      transition: { transitionName: null, transitionDuration: null },
    },
    {
      id: "scene-break",
      name: "Example break",
      kind: "scene",
      items: [],
      transition: { transitionName: null, transitionDuration: null },
    },
    {
      id: "scene-intro",
      name: "Example intro",
      kind: "scene",
      items: [],
      transition: { transitionName: null, transitionDuration: null },
    },
  ];
  constructor() {
    this.add(this.scenes[0]!, this.inputs[0]!);
    const camera = this.add(this.scenes[0]!, this.inputs[1]!);
    camera.enabled = false;
    camera.locked = true;
    camera.transform.positionX = 1200;
    camera.blend = "OBS_BLEND_MULTIPLY";
    this.add(this.scenes[1]!, this.inputs[1]!);
    this.add(this.scenes[2]!, this.inputs[2]!);
    this.add(this.groups[0]!, this.inputs[2]!);
  }
  readSnapshot = (): ObsSnapshot => ({
    epoch: this.epoch,
    revision: this.version + 1,
    sceneVersion: this.version,
    sceneCollectionVersion: this.collection,
    scenes: this.scenes.map((scene) => ({ id: scene.id, name: scene.name })),
    programSceneId: this.programId,
    previewSceneId: null,
    active: this.active,
    reconnecting: false,
    transitioning: false,
    timecode: "00:05:00.000",
    observedAt: new Date().toISOString(),
  });
  snapshot = async (): Promise<ObsSnapshot> => this.readSnapshot();
  context = () => ({
    epoch: this.epoch,
    collection: this.collection,
    revision: this.version,
  });
  private add(scene: Scene, source: Source): Item {
    const item = {
      id: this.nextId++,
      source,
      enabled: true,
      locked: false,
      index: scene.items.length,
      blend: "OBS_BLEND_NORMAL",
      transform: {
        positionX: 0,
        positionY: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        cropTop: 0,
        cropBottom: 0,
        cropLeft: 0,
        cropRight: 0,
      },
    };
    scene.items.push(item);
    return item;
  }
  private scene(data: Record<string, unknown>): Scene {
    const name = text(data.sceneName);
    const scene = [...this.scenes, ...this.groups].find(
      (scene) => scene.name === name,
    );
    if (!scene)
      throw new IntegrationFailure("delivery", "Example scene not found");
    return scene;
  }
  private item(data: Record<string, unknown>): Item {
    const item = this.scene(data).items.find(
      (item) => item.id === integer(data.sceneItemId),
    );
    if (!item)
      throw new IntegrationFailure("delivery", "Example item not found");
    return item;
  }
  private raw(scene: Scene) {
    return scene.items.map((item) => ({
      sceneItemId: item.id,
      sceneItemIndex: item.index,
      sceneItemEnabled: item.enabled,
      sceneItemLocked: item.locked,
      sourceName: item.source.name,
      sourceUuid: item.source.id,
      sourceType:
        item.source.kind === "input"
          ? "OBS_SOURCE_TYPE_INPUT"
          : "OBS_SOURCE_TYPE_SCENE",
      isGroup: item.source.kind === "group",
      inputKind: item.source.kind === "input" ? "example_capture" : null,
      sceneItemTransform: { ...item.transform },
    }));
  }
  async request(
    type: ObsSceneRequest,
    data: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    this.requests.push({ type, data: structuredClone(data) });
    let response: Record<string, unknown> = {};
    switch (type) {
      case "GetSceneItemList":
      case "GetGroupSceneItemList":
        return { sceneItems: this.raw(this.scene(data)) };
      case "GetInputList":
        return {
          inputs: this.inputs.map((input) => ({
            inputName: input.name,
            inputUuid: input.id,
            inputKind: "example_capture",
          })),
        };
      case "GetGroupList":
        return { groups: this.groups.map((group) => group.name) };
      case "GetSceneItemBlendMode":
        return { sceneItemBlendMode: this.item(data).blend };
      case "GetSceneSceneTransitionOverride":
        return { ...this.scene(data).transition };
      case "CreateScene": {
        const name = text(data.sceneName);
        if (
          [...this.scenes, ...this.inputs, ...this.groups].some(
            (source) => source.name === name,
          )
        )
          throw new IntegrationFailure(
            "delivery",
            "Example name already exists",
          );
        const id = `scene-${this.nextId++}`;
        this.scenes.push({
          id,
          name,
          kind: "scene",
          items: [],
          transition: { transitionName: null, transitionDuration: null },
        });
        response = { sceneUuid: id };
        break;
      }
      case "SetSceneName":
        this.scene(data).name = text(data.newSceneName);
        break;
      case "SetCurrentProgramScene":
        this.programId = this.scene(data).id;
        break;
      case "RemoveScene": {
        const scene = this.scene(data);
        this.scenes.splice(this.scenes.indexOf(scene), 1);
        if (this.programId === scene.id)
          this.programId = this.scenes[0]?.id ?? "";
        break;
      }
      case "SetSceneItemEnabled":
        if (!this.ignoreVisibility)
          this.item(data).enabled = data.sceneItemEnabled === true;
        break;
      case "SetSceneItemLocked":
        this.item(data).locked = data.sceneItemLocked === true;
        break;
      case "SetSceneItemBlendMode":
        this.item(data).blend = text(data.sceneItemBlendMode);
        break;
      case "SetSceneSceneTransitionOverride":
        this.scene(data).transition = {
          transitionName:
            data.transitionName === null ? null : text(data.transitionName),
          transitionDuration:
            data.transitionDuration === null
              ? null
              : integer(data.transitionDuration),
        };
        break;
      case "CreateSceneItem": {
        const source = [...this.inputs, ...this.scenes, ...this.groups].find(
          (source) => source.name === text(data.sourceName),
        );
        if (!source)
          throw new IntegrationFailure("delivery", "Example source not found");
        const item = this.add(this.scene(data), source);
        item.enabled = data.sceneItemEnabled !== false;
        response = { sceneItemId: item.id };
        break;
      }
      case "RemoveSceneItem": {
        const scene = this.scene(data);
        const item = this.item(data);
        scene.items.splice(scene.items.indexOf(item), 1);
        scene.items.forEach((item, index) => {
          item.index = index;
        });
        break;
      }
      case "SetSceneItemIndex": {
        const scene = this.scene(data);
        const item = this.item(data);
        const index = integer(data.sceneItemIndex);
        scene.items.splice(scene.items.indexOf(item), 1);
        scene.items.splice(index, 0, item);
        scene.items.forEach((item, offset) => {
          item.index = offset;
        });
        break;
      }
      case "DuplicateSceneItem": {
        this.duplicates++;
        if (this.failDuplicateAt === this.duplicates)
          throw new IntegrationFailure("delivery", "Example copy stopped");
        const original = this.item(data);
        const target = this.scene({ sceneName: data.destinationSceneName });
        const item = this.add(target, original.source);
        item.transform = { ...original.transform };
        item.enabled = original.enabled;
        response = { sceneItemId: item.id };
        break;
      }
    }
    this.version++;
    return response;
  }
}
export const OBS_SCENE_SERVER_REQUESTS: ReadonlySet<string> =
  new Set<ObsSceneRequest>([
    "GetSceneItemList",
    "GetGroupSceneItemList",
    "GetInputList",
    "GetGroupList",
    "GetSceneItemBlendMode",
    "GetSceneSceneTransitionOverride",
    "CreateScene",
    "SetSceneName",
    "RemoveScene",
    "SetCurrentProgramScene",
    "SetSceneItemEnabled",
    "SetSceneItemLocked",
    "SetSceneItemBlendMode",
    "SetSceneSceneTransitionOverride",
    "CreateSceneItem",
    "RemoveSceneItem",
    "SetSceneItemIndex",
    "DuplicateSceneItem",
  ]);
