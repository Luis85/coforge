import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { PublicSitePublisher } from "../../../infrastructure/coforge/public-site-publisher";
import {
  createSeed,
  defaultIntegration,
} from "../../../features/coforge/domain/seed";
import { initialProject } from "../../../features/coforge/domain/projects";
import { deferred } from "./execution-fanout-fixture";
import { readFileSync } from "node:fs";
import { renderLegacyPublicSite } from "../../../infrastructure/coforge/public-site-legacy";
import { publicExportBoardCheck } from "../../../infrastructure/coforge/public-export-board-check";
import { StudioService } from "../../../features/coforge/application/studio";
import { MemoryStorage, nodeTimers } from "./memory-storage";

function fixture() {
  const app = new App();
  const kit = createTestApp({
    app,
    layoutReady: true,
    files: { "CoForge/Public/README.md": "Human publication notes.\r\n" },
  });
  const plugin = new (class extends Plugin {})(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  let state = createSeed();
  state.projects = [
    initialProject(
      state.settings,
      defaultIntegration(),
      "2026-10-28T12:00:00Z",
    ),
  ];
  state.activeProjectId = state.projects[0]!.id;
  const publisher: PublicSitePublisher = new PublicSitePublisher(
    plugin,
    () => defaultIntegration(),
    () => [],
    () => state,
  );
  return {
    app,
    kit,
    publisher,
    get state() {
      return state;
    },
    commit: (next: typeof state) => {
      state = next;
    },
  };
}

it("revokes only owned local data files before private commit even when automatic publication is off", async () => {
  const f = fixture();
  await f.publisher.publish(f.state, "CoForge/Public");
  await f.publisher.publish(f.state, "OldWebsite");
  const next = structuredClone(f.state);
  next.projects![0]!.visibility = "private";
  const release = await f.publisher.beforeCommit(next, f.state);
  try {
    for (const folder of ["CoForge/Public", "OldWebsite"]) {
      expect(await f.app.vault.adapter.exists(`${folder}/board.json`)).toBe(
        false,
      );
      expect(await f.app.vault.adapter.exists(`${folder}/index.html`)).toBe(
        false,
      );
    }
    expect(f.kit.read("CoForge/Public/README.md")).toBe(
      "Human publication notes.\r\n",
    );
    f.commit(next);
  } finally {
    release?.();
  }
});

it("holds the publisher lease through commit and re-evaluates queued stale snapshots", async () => {
  const f = fixture();
  await f.publisher.publish(f.state, "CoForge/Public");
  const stale = structuredClone(f.state);
  const next = structuredClone(f.state);
  next.projects![0]!.visibility = "private";
  const release = await f.publisher.beforeCommit(next, f.state);
  let published = false;
  const pending = f.publisher.publish(stale, "CoForge/Public").then(() => {
    published = true;
  });
  await Promise.resolve();
  expect(published).toBe(false);
  f.commit(next);
  release?.();
  await pending;
  expect(f.kit.read("CoForge/Public/board.json")).not.toContain("Mosslight");
  expect(f.kit.read("CoForge/Public/index.html")).not.toContain(
    "Let us pet the forest foxes",
  );
});

it("preserves a human-edited owned artifact and fails privacy precommit without removing other files", async () => {
  const f = fixture();
  await f.publisher.publish(f.state, "CoForge/Public");
  const original = f.kit.read("CoForge/Public/board.json");
  await f.app.vault.adapter.write(
    "CoForge/Public/index.html",
    f.kit.read("CoForge/Public/index.html") + "\nHuman edits to preserve.",
  );
  const next = structuredClone(f.state);
  next.projects![0]!.visibility = "private";
  await expect(f.publisher.beforeCommit(next, f.state)).rejects.toThrow(
    /edited|changed|human/i,
  );
  expect(f.kit.read("CoForge/Public/index.html")).toContain(
    "Human edits to preserve",
  );
  expect(f.kit.read("CoForge/Public/board.json")).toBe(original);
});

const legacyJson = () =>
  readFileSync(
    new URL("./fixtures/public-export-de7cb61.json", import.meta.url),
    "utf8",
  );
const legacyHtml = () =>
  readFileSync(
    new URL("./fixtures/public-export-de7cb61.html", import.meta.url),
    "utf8",
  );

it("verifies genuine base-version exports byte for byte and revokes them after upgrade", async () => {
  const f = fixture();
  expect(
    renderLegacyPublicSite(publicExportBoardCheck(JSON.parse(legacyJson()))),
  ).toBe(legacyHtml());
  await f.app.vault.create("CoForge/Public/board.json", legacyJson());
  await f.app.vault.create("CoForge/Public/index.html", legacyHtml());
  const next = structuredClone(f.state);
  next.projects![0]!.visibility = "private";
  const release = await f.publisher.beforeCommit(next, f.state);
  release?.();
  expect(await f.app.vault.adapter.exists("CoForge/Public/board.json")).toBe(
    false,
  );
  expect(await f.app.vault.adapter.exists("CoForge/Public/index.html")).toBe(
    false,
  );
  expect(f.kit.read("CoForge/Public/README.md")).toBe(
    "Human publication notes.\r\n",
  );
});

it("does not treat edited legacy HTML as owned merely because it contains the generator footer", async () => {
  const f = fixture();
  await f.app.vault.create("CoForge/Public/board.json", legacyJson());
  await f.app.vault.create(
    "CoForge/Public/index.html",
    legacyHtml() + "\nHuman addition.",
  );
  const next = structuredClone(f.state);
  next.projects![0]!.visibility = "private";
  await expect(f.publisher.beforeCommit(next, f.state)).rejects.toThrow(
    /edited|human/i,
  );
  expect(f.kit.read("CoForge/Public/index.html")).toContain("Human addition");
  expect(f.kit.read("CoForge/Public/board.json")).toBe(legacyJson());
});

it("scrubs already-private owned exports on startup but keeps exports already generated under the private policy", async () => {
  const f = fixture();
  await f.publisher.publish(f.state, "CoForge/Public");
  const next = structuredClone(f.state);
  next.projects![0]!.visibility = "private";
  f.commit(next);
  const startup = await f.publisher.beforeCommit(next, null);
  startup?.();
  expect(await f.app.vault.adapter.exists("CoForge/Public/board.json")).toBe(
    false,
  );
  await f.publisher.publish(next, "CoForge/Public");
  const safe = f.kit.read("CoForge/Public/index.html");
  const again = await f.publisher.beforeCommit(next, null);
  again?.();
  expect(f.kit.read("CoForge/Public/index.html")).toBe(safe);
  expect(safe).not.toContain("Mosslight");
});

it("retains ownership through a partially failed publication so revocation can scrub both file versions", async () => {
  const f = fixture();
  await f.publisher.publish(f.state, "CoForge/Public");
  f.state.ideas[0]!.title = "Updated public title";
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  let fail = true;
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(
    async (path, content, options) => {
      if (path === "CoForge/Public/index.html" && fail) {
        fail = false;
        throw new Error("disk unavailable");
      }
      return write(path, content, options);
    },
  );
  await expect(f.publisher.publish(f.state, "CoForge/Public")).rejects.toThrow(
    "disk unavailable",
  );
  const next = structuredClone(f.state);
  next.projects![0]!.visibility = "private";
  const release = await f.publisher.beforeCommit(next, f.state);
  release?.();
  expect(await f.app.vault.adapter.exists("CoForge/Public/board.json")).toBe(
    false,
  );
  expect(await f.app.vault.adapter.exists("CoForge/Public/index.html")).toBe(
    false,
  );
});

it("waits for an active old publication before revocation, then blocks stale queued republishing", async () => {
  const f = fixture();
  const entered = deferred<void>();
  const hold = deferred<void>();
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  let delay = true;
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(
    async (path, content, options) => {
      if (path === "CoForge/Public/board.json" && delay) {
        delay = false;
        entered.resolve();
        await hold.promise;
      }
      return write(path, content, options);
    },
  );
  const stale = structuredClone(f.state);
  const old = f.publisher.publish(stale, "CoForge/Public");
  await entered.promise;
  const next = structuredClone(f.state);
  next.projects![0]!.visibility = "private";
  let leased = false;
  const revoking = f.publisher.beforeCommit(next, f.state).then((release) => {
    leased = true;
    return release;
  });
  const queued = f.publisher.publish(stale, "CoForge/Public");
  await Promise.resolve();
  expect(leased).toBe(false);
  hold.resolve();
  await old;
  const release = await revoking;
  expect(await f.app.vault.adapter.exists("CoForge/Public/board.json")).toBe(
    false,
  );
  f.commit(next);
  release?.();
  await queued;
  expect(f.kit.read("CoForge/Public/board.json")).not.toContain("Mosslight");
});

it("releases the publication lease after a failed visibility write while retaining the fail-closed public denial", async () => {
  const app = new App();
  createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const storage = new MemoryStorage(createSeed());
  const studio: StudioService = new StudioService(storage, {
    runners: { demo: async () => ({}), claude: async () => ({}) },
    timers: nodeTimers(),
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
    beforeCommit: (next, previous) => publisher.beforeCommit(next, previous),
  });
  const publisher: PublicSitePublisher = new PublicSitePublisher(
    plugin,
    () => studio.integration(),
    () => [],
    () => studio.state(),
  );
  try {
    await studio.store.init();
    await publisher.publish(studio.state(), "CoForge/Public");
    storage.failNextSave = true;
    await expect(
      studio.updateProject({ visibility: "private" }),
    ).rejects.toThrow("Disk full");
    expect(studio.state().projects![0]!.visibility).not.toBe("private");
    expect(studio.state().runtime.publicationDeniedProjectIds).toContain(
      studio.state().activeProjectId,
    );
    await publisher.publish(studio.state(), "CoForge/Public");
    expect(
      await app.vault.adapter.read("CoForge/Public/board.json"),
    ).not.toContain("Mosslight");
  } finally {
    await studio.stop();
  }
});

it("preserves unrelated files even when their filenames resemble the managed public export", async () => {
  const f = fixture();
  await f.app.vault.create(
    "CoForge/Public/board.json",
    '{"format":"human-owned","text":"Keep exactly."}',
  );
  await f.app.vault.create(
    "CoForge/Public/index.html",
    "<!doctype html><h1>Human page</h1>\r\n",
  );
  const next = structuredClone(f.state);
  next.projects![0]!.visibility = "private";
  const release = await f.publisher.beforeCommit(next, f.state);
  release?.();
  expect(f.kit.read("CoForge/Public/board.json")).toContain("Keep exactly");
  expect(f.kit.read("CoForge/Public/index.html")).toBe(
    "<!doctype html><h1>Human page</h1>\r\n",
  );
  await expect(f.publisher.publish(next, "CoForge/Public")).rejects.toThrow(
    /changed|human/i,
  );
});

it("tracks folder case variants without invalidating earlier owned bytes or losing revocation", async () => {
  const f = fixture();
  await f.publisher.publish(f.state, "Website");
  f.state.ideas[0]!.title = "New title";
  await f.publisher.publish(f.state, "website");
  const next = structuredClone(f.state);
  next.projects![0]!.visibility = "private";
  const release = await f.publisher.beforeCommit(next, f.state);
  release?.();
  for (const folder of ["Website", "website"])
    expect(await f.app.vault.adapter.exists(`${folder}/index.html`)).toBe(
      false,
    );
});
