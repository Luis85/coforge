// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { councilControlsFixture } from "./council-controls-fixture";
import { defaultCouncilDefinition } from "../../../features/coforge/domain/council-definitions";

it("enforces council revocation independently of a user-chosen direct- ID prefix", async () => {
  vi.useFakeTimers();
  const f = await councilControlsFixture();
  try {
    const team = (await f.module.actions.catalogue.list()).valid.find(
      (entry) => entry.definition.id === "team",
    )?.definition;
    if (!team || team.schema !== "team/v1")
      throw new Error("Expected the configured team.");
    const council = defaultCouncilDefinition(
      "direct-review",
      "A real council",
      team,
      ["agent"],
    );
    await f.module.actions.catalogue.save(council);
    const target = {
      kind: "council" as const,
      id: council.id,
      teamId: team.id,
    };
    const run = await f.module.actions.simulate(
      target,
      "Private/Proposal.md",
      "CoForge/Tests/Prefix.md",
    );
    const revision = (await f.module.actions.catalogue.list()).valid.find(
      (entry) => entry.definition.id === council.id,
    )!.revision;
    await f.module.actions.catalogue.save(
      { ...council, enabled: false },
      revision,
    );
    await f.module.actions.resume();
    await vi.advanceTimersByTimeAsync(1600);
    const current = f.module.actions
      .snapshot()
      .runs.find((item) => item.id === run.id)!;
    expect(current.state).toBe("attention");
    expect(current.artifacts).toHaveLength(0);
  } finally {
    await f.dispose();
    vi.useRealTimers();
  }
});
