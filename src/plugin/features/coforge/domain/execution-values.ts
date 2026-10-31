import { list, number, oneOf, optional, shape, text, boolean } from "./check";
import { stageUsageCheck } from "./ai-usage";
import { reasoningEffortCheck } from './provider-models';
import { councilPromptOrderCheck } from "./council-prompt-order";
import {
  workflowPlanCheck,
  workflowSerializedSize,
} from "./configured-workflow-run";
import { teamMessageDraftCheck } from "./team-messages";
import type { ExecutionSubject, ExecutionResponse } from "./execution-types";
export const executionIdCheck = text({
  min: 1,
  max: 200,
  pattern: /^[\w.:/-]+$/,
});
export const executionIdsCheck = list(executionIdCheck, { max: 200 });
export const executionProviderCheck = oneOf([
  "demo",
  "claude",
  "herdr", "codex",
] as const);
const id = executionIdCheck;
const ids = executionIdsCheck;
const provider = executionProviderCheck;
export function executionSubjectCheck(value: unknown): ExecutionSubject {
  const result = shape(
    {
      kind: oneOf(["note", "idea"] as const),
      sourceId: id,
      revision: id,
      markdown: text({ min: 1, max: 160000 }),
      ideaId: optional(id),
      ideaRevision: optional(id),
    },
    { strict: true },
  )(value);
  if (result.kind === "idea") {
    if (!result.ideaId)
      throw new Error("An Idea subject requires its existing Idea identity.");
    return { ...result, kind: "idea", ideaId: result.ideaId };
  }
  if (result.ideaId !== undefined || result.ideaRevision !== undefined)
    throw new Error("A generic note cannot claim Idea identity.");
  return {
    kind: "note",
    sourceId: result.sourceId,
    revision: result.revision,
    markdown: result.markdown,
  };
}
export const executionInvocationCheck = shape(
  {
    id,
    roundId: id,
    promptOrder: optional(councilPromptOrderCheck),
    agentId: id,
    agentRevision: id,
    provider,
    model: text({ min: 1, max: 200 }),
    effort: optional(reasoningEffortCheck),
    instructions: text({ min: 1, max: 16000 }),
    access: oneOf(["none"] as const),
    inputRoundIds: ids,
    output: optional(oneOf(["markdown", "plan"] as const)),
    maxArtifactCharacters: optional(
      number({ min: 100, max: 16000, integer: true }),
    ),
    executionScope: optional(
      shape(
        { id, limitMs: number({ min: 1, max: 7200000, integer: true }) },
        { strict: true },
      ),
    ),
  },
  { strict: true },
);
export const executionDispatchCheck = shape(
  { prompt: text({ min: 1, max: 160000 }), inputArtifactIds: ids },
  { strict: true },
);
const responseShape = shape(
  {
    markdown: text({ min: 1, max: 16000 }),
    simulated: boolean,
    costUsd: optional(number({ min: 0 })),
    usage: optional(stageUsageCheck),
    messageDrafts: optional(list(teamMessageDraftCheck, { max: 100 })),
    plan: optional(workflowPlanCheck),
  },
  { strict: true },
);
export function executionResponseCheck(value: unknown): ExecutionResponse {
  const result = responseShape(value);
  if (workflowSerializedSize(result) > 32000)
    throw new Error(
      "The response and message intents exceed their reserved evidence allowance.",
    );
  return result;
}
