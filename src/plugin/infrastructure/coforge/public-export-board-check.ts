import {
  boolean,
  list,
  number,
  oneOf,
  optional,
  shape,
  text,
  timestamp,
  type Check,
} from "../../features/coforge/domain/check";
import type { PublicBoard } from "../../features/coforge/domain/public-board";
import {
  CONTRIBUTOR_COLORS,
} from "../../features/coforge/domain/types";
import { BADGE_DEFINITIONS } from "../../features/coforge/domain/recognition";
import { categoryNameCheck } from '../../features/coforge/domain/request-categories';

const string = text();
const count = number({ min: 0, integer: true });
const plan = shape({ summary: string, steps: list(string) }, { strict: true });
const contributor = shape(
  {
    name: string,
    color: oneOf(CONTRIBUTOR_COLORS),
    ideas: count,
    votesReceived: count,
    implementations: count,
    badges: list(
      shape(
        {
          id: oneOf(BADGE_DEFINITIONS.map((item) => item.id)),
          title: string,
          description: string,
          earned: boolean,
          current: count,
          threshold: count,
        },
        { strict: true },
      ),
    ),
  },
  { strict: true },
);
const idea = shape(
  {
    id: string,
    title: string,
    description: string,
    category: categoryNameCheck,
    status: string,
    column: oneOf(["inbox", "next", "progress", "done"] as const),
    votes: count,
    rice: (value: unknown) => (value === null ? null : number()(value)),
    author: string,
    plan: (value: unknown) => (value === null ? null : plan(value)),
    contexts: optional(
      list(shape({ author: string, text: string }, { strict: true })),
    ),
  },
  { strict: true },
);

/** Legacy ownership is accepted only for a fully valid public projection and exact known HTML. */
export const publicExportBoardCheck: Check<PublicBoard> = shape(
  {
    format: oneOf(["coforge-public-board/v1"] as const),
    generatedAt: timestamp,
    project: string,
    projectId: string,
    columns: list(
      shape(
        {
          id: oneOf(["inbox", "next", "progress", "done"] as const),
          title: string,
          hint: string,
          ideas: list(idea),
        },
        { strict: true },
      ),
    ),
    awaitingScreening: count,
    contributors: list(contributor),
    leaderboards: shape(
      {
        votes: list(contributor),
        ideas: list(contributor),
        implementations: list(contributor),
      },
      { strict: true },
    ),
  },
  { strict: true },
);
