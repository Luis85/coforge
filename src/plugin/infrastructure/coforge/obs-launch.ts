import { execFile, spawn } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { posix, win32 } from "node:path";
import { IntegrationFailure } from "../../features/coforge/domain/integration-failure";
import type { ObsInstallation } from "../../features/coforge/domain/obs";

export interface ObsLaunchHost {
  platform: string;
  env: Record<string, string | undefined>;
  isExecutable(path: string): Promise<boolean>;
  running(): Promise<boolean>;
  spawn(executable: string, cwd: string): Promise<void>;
}
const failure = (message: string) => new IntegrationFailure("service", message);
const nativeHost: ObsLaunchHost = {
  platform: process.platform,
  env: process.env,
  async isExecutable(path) {
    try {
      await access(path, constants.X_OK);
      return (await stat(path)).isFile();
    } catch {
      return false;
    }
  },
  running() {
    const windows = process.platform === "win32";
    return new Promise((resolve, reject) => {
      execFile(
        windows ? "tasklist.exe" : "/usr/bin/pgrep",
        windows
          ? ["/FI", "IMAGENAME eq obs64.exe", "/FO", "CSV", "/NH"]
          : ["-x", process.platform === "darwin" ? "OBS" : "obs"],
        { windowsHide: true, timeout: 3000, maxBuffer: 65536 },
        (error, stdout) => {
          if (error && !("code" in error && error.code === 1 && !windows)) {
            reject(failure("Could not check whether OBS is running. Open OBS manually and connect."));
            return;
          }
          resolve(windows ? /"obs64\.exe"/i.test(stdout) : /^\d+/m.test(stdout));
        },
      );
    });
  },
  spawn(executable, cwd) {
    return new Promise((resolve, reject) => {
      try {
        const child = spawn(executable, [], { cwd, shell: false, detached: true, stdio: "ignore", windowsHide: false });
        child.once("error", () =>
          reject(failure("OBS could not be opened. Check the installed executable and permissions.")),
        );
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      } catch {
        reject(failure("OBS could not be opened. Check the installed executable and permissions."));
      }
    });
  },
};

/** Read-only installation/process discovery. It never starts OBS or reads its private configuration. */
export async function detectObs(
  configured: string,
  host: ObsLaunchHost = nativeHost,
  signal?: AbortSignal,
): Promise<ObsInstallation> {
  const checkOpen = () => {
    if (signal?.aborted) throw failure("Opening OBS was cancelled because CoForge closed.");
  };
  checkOpen();
  const path = host.platform === "win32" ? win32 : posix;
  const explicit = configured.trim();
  if (
    explicit &&
    (!path.isAbsolute(explicit) ||
      /[\r\n\0]/.test(explicit) ||
      (host.platform === "win32" && !/\.exe$/i.test(explicit)))
  )
    throw new IntegrationFailure(
      "validation",
      "Choose the full path to the native OBS executable, without arguments or shell scripts.",
    );
  const running = await host.running();
  checkOpen();
  if (running) return { status: "running", running: true, passwordSaved: false };
  const candidates = explicit
    ? [explicit]
    : host.platform === "win32"
      ? [
          path.join(host.env.ProgramFiles ?? "C:\\Program Files", "obs-studio", "bin", "64bit", "obs64.exe"),
          ...(host.env.LOCALAPPDATA
            ? [path.join(host.env.LOCALAPPDATA, "Programs", "obs-studio", "bin", "64bit", "obs64.exe")]
            : []),
        ]
      : host.platform === "darwin"
        ? [
            "/Applications/OBS.app/Contents/MacOS/OBS",
            ...(host.env.HOME ? [path.join(host.env.HOME, "Applications/OBS.app/Contents/MacOS/OBS")] : []),
          ]
        : [
            "/usr/bin/obs",
            "/usr/local/bin/obs",
            ...(host.env.PATH ?? "")
              .split(":")
              .filter(Boolean)
              .map((folder) => path.join(folder, "obs")),
          ];
  for (const candidate of candidates) {
    if (!(await host.isExecutable(candidate))) continue;
    checkOpen();
    return { status: "found", running: false, executable: candidate, passwordSaved: false };
  }
  return { status: "missing", running: false, passwordSaved: false };
}

/** Opens the native application only: fixed empty argv, no shell, no broadcasting or credential arguments. */
export async function launchObs(
  configured: string,
  host: ObsLaunchHost = nativeHost,
  signal?: AbortSignal,
): Promise<void> {
  const installation = await detectObs(configured, host, signal);
  if (signal?.aborted) throw failure("Opening OBS was cancelled because CoForge closed.");
  if (installation.running) return;
  if (installation.executable) {
    const path = host.platform === "win32" ? win32 : posix;
    await host.spawn(installation.executable, path.dirname(installation.executable));
    return;
  }
  throw new IntegrationFailure(
    "validation",
    "OBS Studio was not found. Install OBS or enter its full executable path in OBS setup.",
  );
}
