import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const imageId = process.env.COFORGE_VERIFICATION_IMAGE ?? "";
const docker = process.env.COFORGE_VERIFICATION_DOCKER ?? "docker";
async function main() {
  if (process.argv.includes("--help")) {
    console.log(
      "Usage: COFORGE_VERIFICATION_IMAGE=sha256:<existing-local-prepared-image-id> npm run test:workflow-verification -- [vitest filters/options]\nRequires a running local Docker Linux engine and the explicitly prepared fixture image from tooling/tests/workflow-verification/image/Dockerfile. This runner never pulls or builds an image.",
    );
    return 0;
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(imageId)) {
    console.error(
      "Workflow verification qualification requires COFORGE_VERIFICATION_IMAGE=sha256:<existing local image ID>. Provision the pinned image explicitly; no tests were run and nothing was downloaded.",
    );
    return 2;
  }
  await mkdir("reports/workflow-verification", { recursive: true });
  const context = await command(
    docker,
    ["context", "inspect", "--format", "{{json .Endpoints.docker.Host}}"],
    true,
  );
  let endpoint;
  try {
    endpoint = JSON.parse(context.output.trim());
  } catch {
    /* No trusted local endpoint. */
  }
  if (
    typeof endpoint !== "string" ||
    !/^npipe:\/\/\/\/\.\/pipe\/[a-zA-Z0-9_.-]+$|^unix:\/\/\/[^\0\r\n]+$/u.test(
      endpoint,
    )
  ) {
    console.error(
      "Qualification requires a local Docker Unix socket or Windows named pipe. Remote contexts are not supported.",
    );
    return 2;
  }
  const inspect = await command(
    docker,
    ["--host", endpoint, "image", "inspect", imageId, "--format", "{{json .}}"],
    true,
  );
  let image;
  try {
    image = JSON.parse(inspect.output.trim());
  } catch {
    /* Missing image is an explicit qualification failure. */
  }
  if (inspect.code !== 0 || image?.Id !== imageId || image?.Os !== "linux") {
    console.error(
      "The exact provisioned Linux verification image is unavailable. Start the local Docker engine and load that image explicitly. No tests were skipped or downloaded.",
    );
    return 2;
  }
  await writeFile(
    "reports/workflow-verification/environment.json",
    JSON.stringify(
      {
        sourceCommit: process.env.GITHUB_SHA ?? null,
        node: process.version,
        imageId,
        imageOs: image.Os,
        imageArchitecture: image.Architecture,
      },
      null,
      2,
    ) + "\n",
  );
  return (
    await command(process.execPath, [
      resolve("node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      "configs/testing/vitest.verification.config.mjs",
      ...process.argv.slice(2),
    ])
  ).code;
}
process.exitCode = await main();

function command(executable, args, capture = false) {
  return new Promise((resolveResult) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    const timeout = capture ? setTimeout(() => child.kill(), 20000) : undefined;
    let output = "";
    if (capture)
      for (const stream of [child.stdout, child.stderr])
        stream.on("data", (data) => {
          output = (output + data.toString()).slice(0, 262144);
        });
    const forward = (signal) => child.kill(signal);
    process.on("SIGINT", forward);
    process.on("SIGTERM", forward);
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      process.off("SIGINT", forward);
      process.off("SIGTERM", forward);
    };
    child.once("error", () => {
      cleanup();
      resolveResult({ code: 2, output });
    });
    child.once("close", (code, signal) => {
      cleanup();
      resolveResult({ code: code ?? (signal ? 1 : 2), output });
    });
  });
}
