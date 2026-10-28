import { shape, text } from "./check";
export const linkedCouncilIdeaCheck = shape(
  {
    ideaId: text({ min: 1, max: 200, pattern: /^CF-\d+$/u }),
    revision: text({ min: 1, max: 200, pattern: /^[\w:.-]+$/u }),
  },
  { strict: true },
);
export type LinkedCouncilIdea = ReturnType<typeof linkedCouncilIdeaCheck>;
