import { realpath, stat } from "node:fs/promises";
import { isAbsolute, normalize } from "node:path";
import { tmpdir } from "node:os";
import type { HerdrGateway } from "../../features/coforge/application/herdr-ports";
import {
  herdrReady,
  sameHerdrAgent,
  type HerdrAgent,
  type HerdrPane,
  type HerdrSettings,
} from "../../features/coforge/domain/herdr";
import { record } from "../../features/coforge/domain/check";
import { captureProcess } from "./process";
import {
  decodeHerdrAgent,
  decodeHerdrPane,
  decodeHerdrWorkspace,
  herdrId,
  herdrList,
  herdrResult,
} from "./herdr-protocol";
export type HerdrCommand = (
  executable: string,
  args: readonly string[],
  options: {
    cwd: string;
    signal: AbortSignal;
    timeoutMs: number;
    maxBytes: number;
  },
) => Promise<string>;
/** Narrow native CLI adapter, matching Companion's verified session and target-identity checks. */
export class LocalHerdrGateway implements HerdrGateway {
  private readonly cancellation = new AbortController();
  constructor(private readonly run: HerdrCommand = captureProcess) {}
  private async command(
    settings: HerdrSettings,
    args: string[],
    timeoutMs = 10000,
  ): Promise<string> {
    if (
      !settings.executable.trim() ||
      /\.(cmd|bat)$/i.test(settings.executable) ||
      [...settings.executable].some((char) => char.charCodeAt(0) < 32) ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(settings.session) ||
      args.some((arg) => arg.includes("\0"))
    )
      throw new Error(
        "Use a native Herdr executable and a valid session name.",
      );
    const complete = ["--session", settings.session, ...args];
    if (
      settings.executable.length +
        complete.reduce((size, arg) => size + arg.length * 2 + 3, 0) >
      30000
    )
      throw new Error(
        "The Herdr request is too large for the native command interface.",
      );
    try {
      return await this.run(settings.executable, complete, {
        cwd: tmpdir(),
        signal: this.cancellation.signal,
        timeoutMs,
        maxBytes: 1024 * 1024,
      });
    } catch {
      throw new Error(
        "Herdr is unavailable or did not confirm this command. Check the native executable, running session and installed agent. Refresh and inspect Herdr before retrying.",
      );
    }
  }
  private async status(settings: HerdrSettings) {
    const value = record(
      JSON.parse(await this.command(settings, ["status", "server", "--json"])),
    );
    if (
      typeof value.running !== "boolean" ||
      (value.session ?? "default") !== settings.session ||
      typeof value.compatible !== "boolean" ||
      typeof value.version !== "string"
    )
      throw new Error(
        "Herdr returned an incompatible or different session. Check its executable and session setting.",
      );
    return {
      running: value.running,
      compatible: value.compatible,
      version: value.version,
    };
  }
  private async result(
    settings: HerdrSettings,
    args: string[],
    type: string,
    timeout?: number,
  ) {
    try {
      return herdrResult(await this.command(settings, args, timeout), type);
    } catch {
      throw new Error(
        "Herdr did not confirm this operation. Refresh and inspect its session before retrying.",
      );
    }
  }
  async read(settings: HerdrSettings) {
    const status = await this.status(settings);
    if (!status.running || !status.compatible)
      return { ...status, workspaces: [], panes: [], agents: [] };
    const [spaces, shells, agents] = await Promise.all([
      this.result(settings, ["workspace", "list"], "workspace_list"),
      this.result(settings, ["pane", "list"], "pane_list"),
      this.result(settings, ["agent", "list"], "agent_list"),
    ]);
    const panes = herdrList(shells.panes).map(decodeHerdrPane);
    return {
      ...status,
      panes,
      workspaces: herdrList(spaces.workspaces).map((value) =>
        decodeHerdrWorkspace(value, panes),
      ),
      agents: herdrList(agents.agents).map(decodeHerdrAgent),
    };
  }
  async sameDirectory(left: string, right: string): Promise<boolean> {
    try {
      if (!isAbsolute(left) || !isAbsolute(right)) return false;
      const [a, b] = await Promise.all([realpath(left), realpath(right)]);
      if (!(await stat(a)).isDirectory() || !(await stat(b)).isDirectory())
        return false;
      return process.platform === "win32"
        ? normalize(a).toLowerCase() === normalize(b).toLowerCase()
        : a === b;
    } catch {
      return false;
    }
  }
  private async stable(settings: HerdrSettings): Promise<void> {
    const status = await this.status(settings);
    if (!status.running || !status.compatible)
      throw new Error("Connect a compatible running Herdr session first.");
  }
  private async resolve(
    settings: HerdrSettings,
    expected: HerdrAgent,
  ): Promise<HerdrAgent> {
    await this.stable(settings);
    const result = await this.result(
      settings,
      ["agent", "get", herdrId(expected.paneId)],
      "agent_info",
    );
    const current = decodeHerdrAgent(result.agent);
    if (
      !sameHerdrAgent(current, expected) ||
      !(await this.sameDirectory(expected.cwd, current.cwd))
    )
      throw new Error(
        "The selected agent or its directory changed. Refresh and review the target.",
      );
    return current;
  }
  async createWorkspace(
    settings: HerdrSettings,
    path: string,
    name: string,
  ): Promise<void> {
    await this.stable(settings);
    if (
      !(await this.sameDirectory(path, path)) ||
      !name.trim() ||
      name.length > 80 ||
      name.startsWith("-") ||
      [...name].some((char) => char.charCodeAt(0) < 32)
    )
      throw new Error(
        "Set an existing absolute project directory and a name of up to 80 characters.",
      );
    const result = await this.result(
      settings,
      ["workspace", "create", "--cwd", path, "--label", name, "--no-focus"],
      "workspace_created",
    );
    const pane = decodeHerdrPane(result.root_pane);
    const workspace = decodeHerdrWorkspace(result.workspace, [pane]);
    if (
      workspace.id !== pane.workspaceId ||
      !(await this.sameDirectory(path, pane.cwd))
    )
      throw new Error(
        "The new workspace could not be confirmed. Refresh Herdr.",
      );
  }
  async startAgent(
    settings: HerdrSettings,
    expected: HerdrPane,
    provider: string,
  ): Promise<void> {
    await this.stable(settings);
    if (!["claude", "codex", "cursor", "opencode"].includes(provider))
      throw new Error("Choose a supported provider.");
    const pane = decodeHerdrPane(
      (
        await this.result(
          settings,
          ["pane", "get", herdrId(expected.id)],
          "pane_info",
        )
      ).pane,
    );
    if (
      pane.id !== expected.id ||
      pane.terminalId !== expected.terminalId ||
      pane.workspaceId !== expected.workspaceId ||
      pane.agent ||
      !(await this.sameDirectory(expected.cwd, pane.cwd))
    )
      throw new Error(
        "The shell pane changed. Refresh and select an empty shell.",
      );
    const result = await this.result(
      settings,
      [
        "agent",
        "start",
        `coforge-${crypto.randomUUID().slice(0, 8)}`,
        "--kind",
        provider,
        "--pane",
        pane.id,
        "--timeout",
        "30000",
      ],
      "agent_started",
      45000,
    );
    const target = decodeHerdrAgent(result.agent);
    if (
      target.paneId !== pane.id ||
      target.terminalId !== pane.terminalId ||
      target.agent !== provider
    )
      throw new Error("The new agent could not be confirmed. Inspect Herdr.");
  }
  async send(
    settings: HerdrSettings,
    expected: HerdrAgent,
    prompt: string,
  ): Promise<void> {
    const current = await this.resolve(settings, expected);
    if (
      !herdrReady(current) ||
      !prompt.trim() ||
      prompt.length > 10000 ||
      [...prompt].some(
        (char) => char.charCodeAt(0) < 32 && !["\n", "\r", "\t"].includes(char),
      )
    )
      throw new Error(
        "Review a bounded prompt and choose a ready agent first.",
      );
    const result = await this.result(
      settings,
      ["agent", "prompt", current.paneId, prompt],
      "agent_prompted",
    );
    if (!sameHerdrAgent(expected, decodeHerdrAgent(result.agent)))
      throw new Error(
        "Herdr acknowledged a different agent. Inspect its session before retrying.",
      );
  }
  async focus(settings: HerdrSettings, target: HerdrAgent): Promise<void> {
    const current = await this.resolve(settings, target);
    await this.result(
      settings,
      ["agent", "focus", current.paneId],
      "agent_info",
    );
  }
  async interrupt(settings: HerdrSettings, target: HerdrAgent): Promise<void> {
    const current = await this.resolve(settings, target);
    if (!current.ready)
      throw new Error(
        "This agent is not ready for terminal input. Inspect Herdr.",
      );
    await this.result(
      settings,
      ["agent", "send-keys", current.paneId, "ctrl+c"],
      "ok",
    );
  }
  dispose(): void {
    this.cancellation.abort();
  }
}
