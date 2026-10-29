import { addRequestContext } from "../../../features/coforge/application/request-context";
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import {
  createIdea,
  addVote,
} from "../../../features/coforge/application/chat";
import {
  atomicCommandFixture,
  atomicExistingFixture,
} from "./atomic-command-fixture";
import { VaultStudioStorage } from "../../../infrastructure/coforge/vault-storage";
import { splitNote } from "../../../infrastructure/coforge/markdown";
it("does not leave a free request note or consume a message receipt when the paid command data commit fails", async () => {
  const f = await atomicCommandFixture();
  const before = f.kit.read(f.storage.dataPath);
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(
    async (path, value) => {
      if (path === f.storage.dataPath) throw new Error("Data unavailable");
      await write(path, value);
    },
  );
  try {
    await expect(
      f.studio.store.transaction(
        (state) => {
          const idea = createIdea(state, {
            username: "Owner",
            title: "A paid request",
            description: "A paid request description",
          });
          state.ingestMeta.processedMessages.push({
            id: "paid-message-one",
            ideaId: idea.id,
          });
        },
        { atomicCommand: true },
      ),
    ).rejects.toThrow("Data unavailable");
    expect(
      f.app.vault
        .getMarkdownFiles()
        .filter((file) => file.path.startsWith("CoForge/Ideas/")),
    ).toHaveLength(0);
    expect(f.kit.read(f.storage.dataPath)).toBe(before);
    expect(
      f.studio.store.internalSnapshot().ingestMeta.processedMessages,
    ).toHaveLength(0);
  } finally {
    vi.restoreAllMocks();
    await f.studio.stop();
  }
});

it("preserves unrelated YAML comments and exact CRLF body bytes while committing a vote and its receipt", async () => {
  const f = await atomicExistingFixture();
  try {
    await f.app.vault.process(f.file, (value) =>
      value
        .replace("---\n", "---\ncustom: 'keep exact' # human comment\n")
        .replaceAll("\n", "\r\n"),
    );
    const body = splitNote(f.kit.read(f.file.path)).body;
    await f.studio.store.transaction(
      (state) => {
        addVote(state, f.idea.id, {
          username: "Viewer",
          userId: "viewer",
          source: "simulator",
        });
        state.ingestMeta.processedMessages.push({
          id: "vote-event",
          ideaId: f.idea.id,
        });
      },
      { atomicCommand: true },
    );
    const after = f.kit.read(f.file.path);
    expect(after).toContain("custom: 'keep exact' # human comment\r\n");
    expect(splitNote(after).body).toBe(body);
    expect(after).toContain("votes: 1");
    expect(f.kit.read(f.storage.dataPath)).toContain("vote-event");
  } finally {
    await f.studio.stop();
  }
});

it("rolls back an exact note write that throws after writing, without charging or acknowledging the command", async () => {
  const f = await atomicExistingFixture();
  const before = f.kit.read(f.file.path);
  const data = f.kit.read(f.storage.dataPath);
  const process = f.app.vault.process.bind(f.app.vault);
  let fail = true;
  vi.spyOn(f.app.vault, "process").mockImplementation(
    async (file, work, options) => {
      const result = await process(file, work, options);
      if (file.path === f.file.path && fail) {
        fail = false;
        throw new Error("Note wrote then failed");
      }
      return result;
    },
  );
  try {
    await expect(
      f.studio.store.transaction(
        (state) => {
          addVote(state, f.idea.id, {
            username: "Viewer",
            source: "simulator",
          });
        },
        { atomicCommand: true },
      ),
    ).rejects.toThrow("Note wrote then failed");
    expect(f.kit.read(f.file.path)).toBe(before);
    expect(f.kit.read(f.storage.dataPath)).toBe(data);
    expect(f.studio.state().ideas[0]!.voters).toHaveLength(0);
  } finally {
    vi.restoreAllMocks();
    await f.studio.stop();
  }
});

it("returns success when data wrote then threw, and retains a committed journal if cleanup is unavailable", async () => {
  const f = await atomicExistingFixture();
  const journalPath = f.storage.dataPath.replace(
    "coforge-state.json",
    "coforge-command-commit.json",
  );
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(
    async (path, value) => {
      await write(path, value);
      if (path === f.storage.dataPath)
        throw new Error("Data wrote then failed");
    },
  );
  vi.spyOn(f.app.vault.adapter, "remove").mockImplementation(async (path) => {
    if (path === journalPath) throw new Error("Receipt busy");
  });
  try {
    await f.studio.store.transaction(
      (state) => {
        addVote(state, f.idea.id, { username: "Viewer", source: "simulator" });
        state.ingestMeta.processedMessages.push({
          id: "one-committed-event",
          ideaId: f.idea.id,
        });
      },
      { atomicCommand: true },
    );
    expect(f.studio.state().ideas[0]!.voters).toHaveLength(1);
    expect(f.kit.read(f.storage.dataPath)).toContain("one-committed-event");
    expect(await f.app.vault.adapter.exists(journalPath)).toBe(true);
    await expect(f.studio.store.transaction(() => {})).rejects.toThrow(
      /recovery/i,
    );
    vi.restoreAllMocks();
    await f.studio.store.transaction(() => {});
    expect(await f.app.vault.adapter.exists(journalPath)).toBe(false);
    expect(
      (
        await new VaultStudioStorage(f.plugin).load()
      ).data?.ingestMeta.processedMessages.filter(
        (item) => item.id === "one-committed-event",
      ),
    ).toHaveLength(1);
  } finally {
    vi.restoreAllMocks();
    await f.studio.stop();
  }
});

it("keeps concurrent human bytes and blocks all later writes and reload after an uncertain rollback", async () => {
  const f = await atomicExistingFixture();
  const data = f.kit.read(f.storage.dataPath);
  let human = "";
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(
    async (path, value) => {
      if (path === f.storage.dataPath) {
        human =
          f.kit.read(f.file.path) +
          "\nA human edit while the ledger was saving.\n";
        await f.app.vault.modify(f.file, human);
        throw new Error("Data unavailable");
      }
      await write(path, value);
    },
  );
  try {
    await expect(
      f.studio.store.transaction(
        (state) => {
          addVote(state, f.idea.id, {
            username: "Viewer",
            source: "simulator",
          });
        },
        { atomicCommand: true },
      ),
    ).rejects.toThrow(/recovery/i);
    expect(f.kit.read(f.file.path)).toBe(human);
    expect(f.kit.read(f.storage.dataPath)).toBe(data);
    await expect(f.studio.store.transaction(() => {})).rejects.toThrow(
      /recovery/i,
    );
    await expect(new VaultStudioStorage(f.plugin).load()).rejects.toThrow(
      /recovery/i,
    );
    expect(f.kit.read(f.file.path)).toBe(human);
  } finally {
    vi.restoreAllMocks();
    await f.studio.stop();
  }
});

it("preserves a human edit racing a newly-created request rollback instead of deleting it", async () => {
  const f = await atomicCommandFixture();
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(
    async (path, value) => {
      if (path === f.storage.dataPath) throw new Error("Data unavailable");
      await write(path, value);
    },
  );
  const rename = f.app.vault.rename.bind(f.app.vault);
  let raced = false;
  let human = "";
  vi.spyOn(f.app.vault, "rename").mockImplementation(async (file, path) => {
    await rename(file, path);
    if (
      !raced &&
      path.endsWith(".coforge-archive") &&
      file instanceof (await import("obsidian")).TFile
    ) {
      raced = true;
      human =
        (await f.app.vault.read(file)) + "\nHuman draft during recovery.\n";
      await f.app.vault.modify(file, human);
    }
  });
  try {
    await expect(
      f.studio.store.transaction(
        (state) => {
          createIdea(state, {
            username: "Owner",
            title: "A paid request",
            description: "An ordinary request.",
          });
        },
        { atomicCommand: true },
      ),
    ).rejects.toThrow(/recovery/i);
    const file = f.app.vault
      .getMarkdownFiles()
      .find((file) => file.path.startsWith("CoForge/Ideas/"));
    expect(file).toBeDefined();
    expect(f.kit.read(file!.path)).toBe(human);
    expect(f.studio.state().ideas).toHaveLength(0);
    await expect(f.studio.store.transaction(() => {})).rejects.toThrow(
      /recovery/i,
    );
  } finally {
    vi.restoreAllMocks();
    await f.studio.stop();
  }
});

it("rolls back an appended context and its screening reset together when the ledger cannot commit", async () => {
  const f = await atomicExistingFixture();
  const before = f.kit.read(f.file.path);
  const state = JSON.stringify(f.studio.state().ideas);
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(
    async (path, value) => {
      if (path === f.storage.dataPath) throw new Error("Data unavailable");
      await write(path, value);
    },
  );
  try {
    await expect(
      f.studio.store.transaction(
        (next) => {
          const result = addRequestContext(
            next,
            f.idea.id,
            "A useful additional constraint",
            "simulator:viewer",
            "Viewer",
            new Date().toISOString(),
            "paid-context-event",
          );
          expect(result.ok).toBe(true);
          next.ingestMeta.processedMessages.push({
            id: "paid-context-message",
            ideaId: f.idea.id,
          });
        },
        { atomicCommand: true },
      ),
    ).rejects.toThrow("Data unavailable");
    expect(f.kit.read(f.file.path)).toBe(before);
    expect(JSON.stringify(f.studio.state().ideas)).toBe(state);
    expect(f.kit.read(f.storage.dataPath)).not.toContain(
      "paid-context-message",
    );
  } finally {
    vi.restoreAllMocks();
    await f.studio.stop();
  }
});
