import { oneOf } from "./check";

export const councilPromptOrderCheck = oneOf([
  "round-robin",
  "fan-out",
] as const);
export type CouncilPromptOrder = ReturnType<typeof councilPromptOrderCheck>;
