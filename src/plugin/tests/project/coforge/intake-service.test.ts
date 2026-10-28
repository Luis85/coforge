import { describe, expect, it } from "vitest";
import {
  validateIntakeBindings,
  routeIntake,
} from "../../../features/coforge/domain/intake-bindings";
import {
  IntakeService,
  type IntakePorts,
  type IntakeState,
} from "../../../features/coforge/application/intake-service";

const binding = {
  id: "inbox",
  path: "Private/Inbox",
  projectId: "CFP-001",
  teamId: "team",
  target: { kind: "council" as const, id: "council" },
  enabled: true,
  recursive: false,
  submit: "after-stable" as const,
  settleMs: 2000,
};
function fixture() {
  let state: IntakeState = { activations: [], observations: [] };
  const admitted = new Set<string>();
  const calls: string[] = [];
  let full = false;
  const ports: IntakePorts = {
    load: async () => structuredClone(state),
    save: async (next) => {
      state = structuredClone(next);
    },
    identify: async (note) => ({
      ...note,
      sourceId: note.sourceId ?? "source",
    }),
    admit: async (input) => {
      calls.push(input.key);
      if (full) return "deferred";
      if (admitted.has(input.key)) return "duplicate";
      admitted.add(input.key);
      return "admitted";
    },
  };
  const service = new IntakeService(ports);
  return {
    service,
    calls,
    full: () => {
      full = true;
    },
    room: () => {
      full = false;
    },
    state: () => state,
  };
}
const note = {
  path: "Private/Inbox/Task.md",
  body: "Human task",
  sourceRevision: "r1",
  generation: 0,
  draft: false,
  ready: false,
};

describe("common inbox admission", () => {
  it("resets only local intake state while durable submission keys still prevent replay after explicit backlog reactivation", async () => {
    const f = fixture();
    await f.service.activate(binding, [], [], 0);
    await f.service.reconcile(binding, [note], 0);
    await f.service.reconcile(binding, [note], 2000);
    expect(f.calls).toHaveLength(1);
    await f.service.reset(binding.id);
    expect(f.state()).toEqual({ activations: [], observations: [] });
    await f.service.activate(binding, [note], ["source"], 3000);
    expect((await f.service.reconcile(binding, [note], 5000))[0]?.status).toBe(
      "admitted",
    );
    expect(new Set(f.calls).size).toBe(1);
  });
  it("selects a previewed ordinary note by path before the host assigns its stable identity", async () => {
    const f = fixture();
    await f.service.activate(binding, [note], [note.path], 0);
    expect((await f.service.reconcile(binding, [note], 2000))[0]?.status).toBe(
      "admitted",
    );
  });
  it("skips an activation baseline and admits selected backlog only once", async () => {
    const f = fixture();
    await f.service.activate(binding, [note], [], 0);
    expect(
      (await f.service.reconcile(binding, [note], 100)).map(
        (item) => item.status,
      ),
    ).toEqual(["baseline"]);
    expect(f.calls).toEqual([]);
    await f.service.activate(
      { ...binding, id: "selected" },
      [note],
      ["source"],
      0,
    );
    expect(
      (
        await f.service.reconcile({ ...binding, id: "selected" }, [note], 2000)
      )[0]?.status,
    ).toBe("admitted");
    expect(
      (
        await f.service.reconcile(
          { ...binding, id: "selected" },
          [{ ...note, body: "changed", sourceRevision: "r2" }],
          4000,
        )
      )[0]?.status,
    ).toBe("admitted");
    expect(new Set(f.calls).size).toBe(1);
  });
  it("waits for stable nonempty input and Draft, preserves capacity deferrals, and admits offline arrivals", async () => {
    const f = fixture();
    await f.service.activate(binding, [], [], 0);
    expect(
      (await f.service.reconcile(binding, [{ ...note, body: "" }], 0))[0]
        ?.status,
    ).toBe("empty");
    expect((await f.service.reconcile(binding, [note], 100))[0]?.status).toBe(
      "settling",
    );
    expect(
      (await f.service.reconcile(binding, [{ ...note, draft: true }], 3000))[0]
        ?.status,
    ).toBe("draft");
    f.full();
    expect((await f.service.reconcile(binding, [note], 4000))[0]?.status).toBe(
      "deferred",
    );
    f.room();
    expect((await f.service.reconcile(binding, [note], 4100))[0]?.status).toBe(
      "admitted",
    );
    let restored = structuredClone(f.state());
    const reloaded = new IntakeService({
      load: async () => structuredClone(restored),
      save: async (next) => {
        restored = next;
      },
      identify: async (value) => ({ ...value, sourceId: "offline" }),
      admit: async () => "admitted",
    });
    expect(
      (
        await reloaded.reconcile(
          binding,
          [{ ...note, path: "Private/Inbox/Offline.md" }],
          5000,
        )
      )[0]?.status,
    ).toBe("settling");
    expect(
      (
        await reloaded.reconcile(
          binding,
          [{ ...note, path: "Private/Inbox/Offline.md" }],
          7000,
        )
      )[0]?.status,
    ).toBe("admitted");
  });
  it("does not resubmit ordinary edits or renames; Run again changes generation", async () => {
    const f = fixture();
    await f.service.activate(binding, [], [], 0);
    await f.service.reconcile(binding, [note], 0);
    await f.service.reconcile(binding, [note], 2000);
    expect(
      (
        await f.service.reconcile(
          binding,
          [{ ...note, path: "Private/Inbox/Renamed.md", sourceRevision: "r2" }],
          3000,
        )
      )[0]?.status,
    ).toBe("admitted");
    expect(f.calls).toHaveLength(1);
    expect(
      (
        await f.service.reconcile(binding, [{ ...note, generation: 1 }], 5000)
      )[0]?.status,
    ).toBe("settling");
    expect(
      (
        await f.service.reconcile(binding, [{ ...note, generation: 1 }], 7000)
      )[0]?.status,
    ).toBe("admitted");
    expect(new Set(f.calls).size).toBe(2);
  });
  it("blocks duplicate source identities before admitting either copy", async () => {
    const f = fixture();
    await f.service.activate(binding, [], [], 0);
    const results = await f.service.reconcile(
      binding,
      [note, { ...note, path: "Private/Inbox/Copy.md" }],
      3000,
    );
    expect(results.map((item) => item.status)).toEqual([
      "attention",
      "attention",
    ]);
    expect(f.calls).toEqual([]);
  });
  it("keeps a valid source blocked when an invalid copied note has the same identity", async () => {
    const f = fixture();
    await f.service.activate(binding, [], [], 0);
    const results = await f.service.reconcile(
      binding,
      [
        note,
        {
          ...note,
          sourceId: "source",
          path: "Private/Inbox/Copy.md",
          error: "Edited generated block.",
        },
      ],
      3000,
    );
    expect(results.every((item) => item.status === "attention")).toBe(true);
    expect(f.calls).toEqual([]);
  });
  it("skips the exact existing generation on activation, including notes run before in another binding", async () => {
    const f = fixture();
    const existing = { ...note, generation: 7 };
    await f.service.activate(binding, [existing], [], 0);
    expect(
      (await f.service.reconcile(binding, [existing], 10000))[0]?.status,
    ).toBe("baseline");
    expect(f.calls).toEqual([]);
    await f.service.reconcile(binding, [{ ...existing, generation: 8 }], 11000);
    expect(
      (
        await f.service.reconcile(
          binding,
          [{ ...existing, generation: 8 }],
          13000,
        )
      )[0]?.status,
    ).toBe("admitted");
  });
  it("rejects overlapping scopes, output loops, configuration/private-public overlap and defaults to immediate children", () => {
    expect(() =>
      validateIntakeBindings(
        [binding, { ...binding, id: "nested", path: "Private/Inbox/Nested" }],
        {
          publicFolder: "Public",
          configFolder: ".obsidian",
          definitionFolders: ["Private/Definitions"],
          outputFolders: ["Private/Results"],
        },
      ),
    ).toThrow("overlap");
    for (const path of [
      "Public/Inbox",
      ".obsidian/inbox",
      "Private/Definitions",
      "Private/Results",
    ])
      expect(() =>
        validateIntakeBindings([{ ...binding, path }], {
          publicFolder: "Public",
          configFolder: ".obsidian",
          definitionFolders: ["Private/Definitions"],
          outputFolders: ["Private/Results"],
        }),
      ).toThrow();
    expect(routeIntake([binding], "Private/Inbox/nested/Task.md")).toBeNull();
    expect(routeIntake([binding], note.path)?.id).toBe("inbox");
  });
});
