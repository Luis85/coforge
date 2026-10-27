import { HerdrService } from "../../src/plugin/features/coforge/application/herdr-service";
import {
  emptyHerdr,
  type HerdrAgent,
  type HerdrWorkspace,
} from "../../src/plugin/features/coforge/domain/herdr";
import type { HerdrSaved } from "../../src/plugin/features/coforge/application/herdr-ports";
import type { StudioStore } from "../../src/plugin/features/coforge/application/studio-store";
export function createHerdrPreview(store: StudioStore) {
  let saved: HerdrSaved = { settings: emptyHerdr().settings, records: [] };
  const extras: HerdrWorkspace[] = [];
  const started: HerdrAgent[] = [];
  const path = () =>
    store
      .snapshot()
      .projects?.find(
        (project) => project.id === store.snapshot().activeProjectId,
      )?.projectPath || "/synthetic/game";
  const service = new HerdrService(
    store,
    {
      read: async () => ({
        running: true,
        compatible: true,
        version: "0.9.5 example",
        workspaces: [
          { id: "w1", name: "Example project", cwd: path() },
          ...extras,
        ],
        panes: started.length
          ? []
          : [
              {
                id: "w1:p1",
                terminalId: "t1",
                workspaceId: "w1",
                cwd: path(),
                agent: "",
              },
            ],
        agents: [
          {
            paneId: "w1:p2",
            terminalId: "t2",
            workspaceId: "w1",
            agent: "claude",
            name: "Example coder",
            cwd: path(),
            status: "idle",
            ready: true,
            sessionRef: "",
          },
          ...started,
        ],
      }),
      sameDirectory: async (left, right) => left === right,
      createWorkspace: async (_settings, cwd, name) => {
        extras.push({ id: "example-" + extras.length, name, cwd });
      },
      startAgent: async (_settings, pane, provider) => {
        started.push({
          paneId: pane.id,
          terminalId: pane.terminalId,
          workspaceId: pane.workspaceId,
          agent: provider,
          name: "Example " + provider,
          cwd: pane.cwd,
          status: "idle",
          ready: true,
          sessionRef: "",
        });
      },
      send: async () => {},
      focus: async () => {},
      interrupt: async () => {},
      dispose: () => {},
    },
    {
      load: async () => structuredClone(saved),
      save: async (next) => {
        saved = structuredClone(next);
      },
    },
  );
  void service.start();
  return service;
}
