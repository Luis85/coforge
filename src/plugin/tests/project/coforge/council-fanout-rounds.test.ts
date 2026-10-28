import { expect, it, vi } from "vitest";
import {
  agentDefinitionCheck,
  defaultCouncilDefinition,
  teamDefinitionCheck,
} from "../../../features/coforge/domain/council-definitions";
import { compileCouncil } from "../../../features/coforge/domain/council-protocol";
import {
  councilAdmission,
  councilDispatch,
} from "../../../features/coforge/application/council-execution";
import type { ExecutionDispatch } from "../../../features/coforge/domain/execution-run";
import { answer, deferred, fanoutFixture } from "./execution-fanout-fixture";

it.each(["round-robin", "fan-out"] as const)(
  "seals independent fan-out opinions in declared order before %s solutions",
  async (mode) => {
    const agents = ["a", "b"].map((id) =>
      agentDefinitionCheck({
        schema: "agent/v1",
        id,
        name: id,
        enabled: true,
        role: "Reviewer",
        instructions: "Independent assessment",
        provider: "demo",
        model: "sonnet",
        contextSources: [],
        requestedCapabilities: { project: "none", messaging: false },
      }),
    );
    const team = teamDefinitionCheck({
      schema: "team/v1",
      id: "team",
      name: "Team",
      enabled: true,
      projectId: "project",
      members: ["a", "b"],
      pinnedContext: [],
      recentMessages: 0,
      allowedRecipients: [],
    });
    const definition = defaultCouncilDefinition("council", "Council", team, [
      "a",
      "b",
    ]);
    definition.rounds[0]!.promptOrder = "fan-out";
    definition.rounds[1]!.promptOrder = mode;
    const input = councilAdmission(
      {
        plan: compileCouncil(definition, team, agents),
        source: {
          sourceId: "source",
          generation: 0,
          revision: "rev-1",
          markdown: "Original human question",
        },
        context: "Captured shared context",
        invocations: 4,
        warnings: [],
      },
      "run",
      "key",
      { timeoutSeconds: 30, maxTurns: 2, maxBudgetUsd: 1, simulation: true },
    );
    const f = fanoutFixture();
    const a = deferred<ReturnType<typeof answer>>();
    const b = deferred<ReturnType<typeof answer>>();
    const dispatches = new Map<string, ExecutionDispatch>();
    f.host.resolveInvocation = councilDispatch;
    f.host.invoke = async (_run, invocation, attempt) => {
      f.entered.push(invocation.id);
      dispatches.set(invocation.id, attempt.dispatch);
      return invocation.roundId === "opinions"
        ? invocation.agentId === "a"
          ? a.promise
          : b.promise
        : answer("Solution");
    };
    await f.kernel.load();
    await f.kernel.admit(input);
    // An ordinary definition edit cannot reinterpret a captured active run.
    definition.rounds[0]!.promptOrder = "round-robin";
    f.kernel.resume();
    const first = f.kernel.step("run");
    await vi.waitFor(() =>
      expect(f.entered).toEqual(["opinions--a", "opinions--b"]),
    );
    expect(dispatches.get("opinions--a")).toEqual(
      dispatches.get("opinions--b"),
    );
    expect(JSON.parse(dispatches.get("opinions--a")!.prompt)).toMatchObject({
      contributions: [],
      sharedContext: "Captured shared context",
    });
    b.resolve(answer("Opinion B"));
    await vi.waitFor(() =>
      expect(f.journal.runs[0]?.artifacts).toHaveLength(1),
    );
    expect(f.entered.every((id) => id.startsWith("opinions"))).toBe(true);
    a.resolve(answer("Opinion A"));
    await first;
    await f.kernel.step("run");
    if (mode === "round-robin") await f.kernel.step("run");
    for (const id of ["solutions--a", "solutions--b"]) {
      const prompt = JSON.parse(dispatches.get(id)!.prompt);
      expect(
        prompt.contributions.map((item: { markdown: string }) => item.markdown),
      ).toEqual(["Opinion A", "Opinion B"]);
      expect(dispatches.get(id)!.inputArtifactIds).toEqual(
        f.journal.runs[0]!.artifacts.filter(
          (item) => item.roundId === "opinions",
        ).map((item) => item.id),
      );
    }
    expect(f.journal.runs[0]?.state).toBe("completed");
  },
);
