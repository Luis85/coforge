import { linkedCouncilIdeaCheck } from "./council-linked-idea";
import { oneOf, shape, text, timestamp, optional } from "./check";

export const COUNCIL_TASK_FOLDER = "CoForge/CouncilTasks";
const identity = text({
  min: 1,
  max: 100,
  pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u,
});
const projectId = text({
  min: 1,
  max: 200,
  pattern: /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u,
});
const title = text({ min: 1, max: 160, trim: true, pattern: /^[^\p{Cc}]+$/u });
const target = shape(
  { kind: oneOf(["agent", "council"]), id: projectId, teamId: projectId },
  { strict: true },
);
export const councilTaskInputCheck = shape(
  {
    projectId,
    target,
    title,
    question: text({ min: 1, max: 60000 }),
    idempotencyKey: identity,
    linkedIdea: optional(linkedCouncilIdeaCheck),
  },
  { strict: true },
);
export const councilTaskMetadataCheck = shape(
  {
    schema: oneOf(["council-task/v1"]),
    projectId,
    target,
    title,
    createdAt: timestamp,
    idempotencyKey: identity,
    linkedIdea: optional(linkedCouncilIdeaCheck),
  },
  { strict: true },
);
export type CouncilTaskMetadata = ReturnType<typeof councilTaskMetadataCheck>;
