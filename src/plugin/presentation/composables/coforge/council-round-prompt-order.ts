import type { CouncilRound } from "../../../features/coforge/domain/council-definitions";
import { councilPromptOrderCheck } from "../../../features/coforge/domain/council-prompt-order";

export function setCouncilRoundPromptOrder(
  round: CouncilRound,
  event: Event,
): void {
  const target = event.target;
  if (target && "value" in target && typeof target.value === "string")
    round.promptOrder = councilPromptOrderCheck(target.value);
}
