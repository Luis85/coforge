import {
  boolean,
  CheckError,
  number,
  oneOf,
  optional,
  record,
  shape,
  text,
} from "./check";
import { OBS_SCENE_KINDS, type ObsSceneAction } from "./obs-scenes";
const id = text({ min: 1, max: 320 });
const name = (value: unknown) => {
  const result = text({ trim: true, min: 1, max: 128 })(value);
  if ([...result].some((character) => character.charCodeAt(0) < 32))
    throw new CheckError("name", "must not contain control characters");
  return result;
};
const expected = shape(
  {
    epoch: number({ integer: true, min: 0 }),
    collection: number({ integer: true, min: 0 }),
    revision: number({ integer: true, min: 0 }),
  },
  { strict: true },
);
const itemId = number({ integer: true, min: 0 });
export function obsSceneAction(input: unknown): ObsSceneAction {
  const kind = oneOf(OBS_SCENE_KINDS)(record(input).kind);
  const common = { expected };
  switch (kind) {
    case "scene-create":
      return shape(
        { ...common, kind: oneOf(["scene-create"] as const), name },
        { strict: true },
      )(input);
    case "scene-rename":
      return shape(
        {
          ...common,
          kind: oneOf(["scene-rename"] as const),
          sceneId: id,
          name,
        },
        { strict: true },
      )(input);
    case "scene-duplicate":
      return shape(
        {
          ...common,
          kind: oneOf(["scene-duplicate"] as const),
          sceneId: id,
          name,
        },
        { strict: true },
      )(input);
    case "scene-delete":
      return shape(
        {
          ...common,
          kind: oneOf(["scene-delete"] as const),
          sceneId: id,
          confirmed: boolean,
          confirmedName: id,
        },
        { strict: true },
      )(input);
    case "scene-switch":
      return shape(
        { ...common, kind: oneOf(["scene-switch"] as const), sceneId: id },
        { strict: true },
      )(input);
    case "item-visible":
      return shape(
        {
          ...common,
          kind: oneOf(["item-visible"] as const),
          sceneId: id,
          itemId,
          enabled: boolean,
        },
        { strict: true },
      )(input);
    case "item-order":
      return shape(
        {
          ...common,
          kind: oneOf(["item-order"] as const),
          sceneId: id,
          itemId,
          direction: oneOf(["up", "down"] as const),
        },
        { strict: true },
      )(input);
    case "item-add":
      return shape(
        {
          ...common,
          kind: oneOf(["item-add"] as const),
          sceneId: id,
          sourceId: id,
          enabled: optional(boolean),
        },
        { strict: true },
      )(input);
    case "item-remove":
      return shape(
        {
          ...common,
          kind: oneOf(["item-remove"] as const),
          sceneId: id,
          itemId,
          confirmed: boolean,
          confirmedName: id,
        },
        { strict: true },
      )(input);
  }
}
