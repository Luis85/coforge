import { describe, expect, it, vi } from "vitest";
import { HerdrService } from "../../../features/coforge/application/herdr-service";
import type {
  HerdrGateway,
  HerdrSaved,
} from "../../../features/coforge/application/herdr-ports";
import { emptyHerdr } from "../../../features/coforge/domain/herdr";
import { seededStore } from "./memory-storage";
import { createSeed } from "../../../features/coforge/domain/seed";
describe("Herdr request boundary", () => {
  it("requires exact review, journals before sending, and preserves unknown delivery across reload", async () => {
    const { store } = await seededStore(createSeed());
    await store.transaction((state) => {
      state.integration.projectPath = "/synthetic/game";
      state.settings.agentPrompt = "Trusted prefix";
    });
    const snapshot = store.snapshot();
    const idea = snapshot.ideas.find(
      (item) => item.screening?.verdict === "clear",
    )!;
    const project = snapshot.projects!.find(
      (item) => item.id === idea.projectId,
    )!;
    let saved: HerdrSaved = { settings: emptyHerdr().settings, records: [] };
    const data = {
      load: async () => structuredClone(saved),
      save: async (value: HerdrSaved) => {
        saved = structuredClone(value);
      },
    };
    const agent = {
      paneId: "pane1",
      terminalId: "terminal1",
      workspaceId: "workspace1",
      agent: "claude",
      name: "Coder",
      cwd: project.projectPath,
      status: "idle",
      ready: true,
      sessionRef: "",
    };
    const gateway: HerdrGateway = {
      read: async () => ({
        running: true,
        compatible: true,
        version: "0.9.5",
        workspaces: [
          { id: "workspace1", name: "Game", cwd: project.projectPath },
        ],
        panes: [],
        agents: [agent],
      }),
      createWorkspace: async () => {},
      startAgent: async () => {},
      focus: async () => {},
      interrupt: async () => {},
      send: vi.fn(async () => {
        expect(saved.records.at(-1)?.status).toBe("pending");
        throw new Error("Lost");
      }),
      sameDirectory: async (a, b) => a === b,
      dispose: () => {},
    };
    const service = new HerdrService(store, gateway, data);
    await service.start();
    await service.refresh();
    const review = service.review(idea.id, agent.paneId);
    expect(review.prompt).toMatch(/^Trusted prefix/);
    await store.transaction((state) => {
      state.settings.agentPrompt += " changed";
    });
    await expect(service.send(review)).rejects.toThrow("changed");
    expect(gateway.send).not.toHaveBeenCalled();
    const updated = service.review(idea.id, agent.paneId);
    const save = data.save;
    data.save = async () => { throw new Error('Write failed'); };
    await expect(service.send(updated)).rejects.toThrow('Write failed');
    expect(gateway.send).not.toHaveBeenCalled();
    data.save = save;
    await expect(service.send(updated)).rejects.toThrow("unconfirmed");
    expect(gateway.send).toHaveBeenCalledOnce();
    await service.dispose();
    const restarted = new HerdrService(store, gateway, data);
    await restarted.start();
    await restarted.refresh();
    await expect(
      restarted.send(restarted.review(idea.id, agent.paneId)),
    ).rejects.toThrow("unconfirmed");
    expect(gateway.send).toHaveBeenCalledOnce();
    await restarted.dispose();
  });
});
