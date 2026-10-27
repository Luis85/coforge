import { describe, expect, it } from "vitest";
import { launchObs, type ObsLaunchHost } from "../../../infrastructure/coforge/obs-launch";

function host() {
  const calls: Array<{ executable: string; cwd: string }> = [];
  const value: ObsLaunchHost = {
    platform: "win32",
    env: { ProgramFiles: "C:\\Program Files" },
    isExecutable: async (path) => path === "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe",
    running: async () => false,
    spawn: async (executable, cwd) => {
      calls.push({ executable, cwd });
    },
  };
  return { value, calls };
}
describe("opening installed OBS", () => {
  it("cancels a pending discovery when the plugin closes", async () => {
    const { value, calls } = host();
    const abort = new AbortController();
    value.isExecutable = async () => {
      abort.abort();
      return true;
    };
    await expect(launchObs("", value, abort.signal)).rejects.toThrow("cancelled");
    expect(calls).toEqual([]);
  });
  it("discovers the Windows binary and starts it in its own directory, with no broadcast arguments", async () => {
    const { value, calls } = host();
    await launchObs("", value);
    expect(calls).toEqual([
      {
        executable: "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe",
        cwd: "C:\\Program Files\\obs-studio\\bin\\64bit",
      },
    ]);
  });
  it("reuses a running OBS and never starts a second instance", async () => {
    const { value, calls } = host();
    value.running = async () => true;
    await launchObs("", value);
    expect(calls).toEqual([]);
  });
  it("rejects shell shims, command strings and missing binaries without launching", async () => {
    const { value, calls } = host();
    for (const path of ["obs.cmd", "obs64.exe --startstreaming", "C:\\missing\\obs64.exe"])
      await expect(launchObs(path, value)).rejects.toThrow();
    expect(calls).toEqual([]);
  });
  it("discovers macOS and Linux native installations", async () => {
    for (const [platform, expected, cwd] of [
      ["darwin", "/Applications/OBS.app/Contents/MacOS/OBS", "/Applications/OBS.app/Contents/MacOS"],
      ["linux", "/usr/bin/obs", "/usr/bin"],
    ] as const) {
      const { value, calls } = host();
      value.platform = platform;
      value.env = {};
      value.isExecutable = async (path) => path === expected;
      await launchObs("", value);
      expect(calls).toEqual([{ executable: expected, cwd }]);
    }
  });
});
