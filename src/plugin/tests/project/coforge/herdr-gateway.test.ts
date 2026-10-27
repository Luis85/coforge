import { describe, expect, it, vi } from "vitest";
import { LocalHerdrGateway } from "../../../infrastructure/coforge/herdr-gateway";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
describe("Herdr native protocol", () => {
  it("uses exact argv and refuses a replacement agent before sending any prompt", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "coforge-herdr-test-"));
    try {
      const raw = {
        pane_id: "w1:p1",
        terminal_id: "t1",
        workspace_id: "w1",
        agent: "claude",
        name: "coder",
        cwd,
        agent_status: "idle",
        interactive_ready: true,
      };
      const commands: string[][] = [];
      let replaced = false;
      const run = vi.fn(async (_executable, args: readonly string[]) => {
        commands.push([...args]);
        if (args.includes("status"))
          return JSON.stringify({
            running: true,
            compatible: true,
            version: "0.9.5",
            session: "default",
          });
        if (args.includes("get"))
          return JSON.stringify({
            result: {
              type: "agent_info",
              agent: { ...raw, terminal_id: replaced ? "replacement" : "t1" },
            },
          });
        return JSON.stringify({
          result: { type: "agent_prompted", agent: raw },
        });
      });
      const gateway = new LocalHerdrGateway(run);
      const settings = { executable: "herdr", session: "default" };
      const agent = {
        paneId: "w1:p1",
        terminalId: "t1",
        workspaceId: "w1",
        agent: "claude",
        name: "coder",
        cwd,
        status: "idle",
        ready: true,
        sessionRef: "",
      };
      await gateway.send(
        settings,
        agent,
        "A literal prompt with $() and `quotes`",
      );
      expect(commands.at(-1)).toEqual([
        "--session",
        "default",
        "agent",
        "prompt",
        "w1:p1",
        "A literal prompt with $() and `quotes`",
      ]);
      replaced = true;
      await expect(
        gateway.send(settings, agent, "Do not send"),
      ).rejects.toThrow("changed");
      expect(commands.filter((args) => args.includes("prompt"))).toHaveLength(
        1,
      );
      gateway.dispose();
      expect(run.mock.calls[0]?.[0]).toBe("herdr");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
