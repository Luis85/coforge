import { expect, it } from "vitest";
import {
  councilRunState,
  legacyRunMatches,
  councilProgressAnnouncement,
} from "../../../presentation/composables/coforge/council-monitor-display";

it("keeps partially progressed work queued and announces completion only at the terminal state", () => {
  expect(councilRunState({ state: "queued", hasGaps: true })).toBe(
    "queued · missing contributions",
  );
  expect(councilRunState({ state: "completed", hasGaps: true })).toBe(
    "Completed with gaps",
  );
  expect(
    councilProgressAnnouncement({
      state: "queued",
      hasGaps: true,
      cursor: 1,
      invocations: [
        { roundId: "opinion", agentId: "reviewer" },
        { roundId: "solution", agentId: "reviewer" },
      ],
    }),
  ).toContain("1 of 2 steps completed or skipped");
  expect(
    councilProgressAnnouncement({
      state: "completed",
      cursor: 2,
      invocations: [],
    }),
  ).toContain("completed");
});

it("applies common source/state filters to legacy work and excludes dimensions it cannot represent", () => {
  const run = {
    projectId: "project",
    sourceId: "CF-100",
    state: "awaiting-review",
  };
  const filters = {
    projectFilter: "",
    sourceFilter: "CF-100",
    stateFilter: "awaiting-review",
    teamFilter: "",
    targetFilter: "",
  };
  expect(legacyRunMatches(run, filters)).toBe(true);
  expect(legacyRunMatches(run, { ...filters, sourceFilter: "other" })).toBe(
    false,
  );
  expect(legacyRunMatches(run, { ...filters, teamFilter: "team" })).toBe(false);
  expect(
    legacyRunMatches(run, { ...filters, targetFilter: "reusable-agent" }),
  ).toBe(false);
});
