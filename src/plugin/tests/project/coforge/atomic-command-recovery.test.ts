import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { VaultCommandCommit } from "../../../infrastructure/coforge/vault-command-commit";
import {
  VaultStudioStorage,
  readIdeaNote,
} from "../../../infrastructure/coforge/vault-storage";
import { parseAtomicCommand } from "../../../infrastructure/coforge/atomic-command-format";
import {
  atomicExistingFixture,
  preparedJournal,
} from "./atomic-command-fixture";

it("rolls back a prepared note after a process crash before data commit, including a second interrupted rollback", async () => {
  const f = await atomicExistingFixture();
  const journal = preparedJournal(f);
  const commit = new VaultCommandCommit(
    f.plugin,
    f.storage.dataPath,
    (bytes) => readIdeaNote(bytes)?.id,
  );
  try {
    await f.app.vault.adapter.write(
      commit.journalPath,
      JSON.stringify(journal),
    );
    await f.app.vault.modify(f.file, journal.notes[0]!.after);
    const recovered = await new VaultStudioStorage(f.plugin).load();
    expect(f.kit.read(f.file.path)).toBe(journal.notes[0]!.before);
    expect(recovered.data?.ingestMeta.processedMessages).not.toContainEqual({
      id: "frozen-event-outcome",
      ideaId: f.idea.id,
    });
    expect(await f.app.vault.adapter.exists(commit.journalPath)).toBe(false);
    // A crash after one note was already restored is idempotent too.
    await f.app.vault.adapter.write(
      commit.journalPath,
      JSON.stringify(journal),
    );
    await new VaultStudioStorage(f.plugin).load();
    expect(f.kit.read(f.file.path)).toBe(journal.notes[0]!.before);
  } finally {
    await f.studio.stop();
  }
});

it("recognizes a committed data file after a process crash and preserves later human note edits", async () => {
  const f = await atomicExistingFixture();
  const journal = preparedJournal(f);
  const commit = new VaultCommandCommit(
    f.plugin,
    f.storage.dataPath,
    (bytes) => readIdeaNote(bytes)?.id,
  );
  try {
    await f.app.vault.adapter.write(
      commit.journalPath,
      JSON.stringify(journal),
    );
    await f.app.vault.modify(
      f.file,
      journal.notes[0]!.after + "\nHuman annotation after commit.\n",
    );
    const human = f.kit.read(f.file.path);
    await f.app.vault.adapter.write(f.storage.dataPath, journal.afterData);
    const loaded = await new VaultStudioStorage(f.plugin).load();
    expect(loaded.data?.ingestMeta.processedMessages).toContainEqual({
      id: "frozen-event-outcome",
      ideaId: f.idea.id,
    });
    expect(f.kit.read(f.file.path)).toBe(human);
    expect(await f.app.vault.adapter.exists(commit.journalPath)).toBe(false);
  } finally {
    await f.studio.stop();
  }
});

it("preserves an unknown/truncated data write and holds loading instead of guessing or replaying the command", async () => {
  const f = await atomicExistingFixture();
  const journal = preparedJournal(f);
  const commit = new VaultCommandCommit(
    f.plugin,
    f.storage.dataPath,
    (bytes) => readIdeaNote(bytes)?.id,
  );
  try {
    await f.app.vault.adapter.write(
      commit.journalPath,
      JSON.stringify(journal),
    );
    await f.app.vault.modify(f.file, journal.notes[0]!.after);
    await f.app.vault.adapter.write(f.storage.dataPath, "{partial");
    await expect(new VaultStudioStorage(f.plugin).load()).rejects.toThrow(
      /command commit needs recovery/i,
    );
    expect(f.kit.read(f.storage.dataPath)).toBe("{partial");
    expect(f.kit.read(f.file.path)).toBe(journal.notes[0]!.after);
    expect(f.kit.read(commit.journalPath)).toBe(JSON.stringify(journal));
  } finally {
    await f.studio.stop();
  }
});

it("validates exact private note identities and captured before/after data before any recovery write", async () => {
  const f = await atomicExistingFixture();
  const journal = preparedJournal(f);
  try {
    const readId = (bytes: string) => readIdeaNote(bytes)?.id;
    expect(() =>
      parseAtomicCommand(
        JSON.stringify(journal),
        f.app.vault.configDir,
        readId,
      ),
    ).not.toThrow();
    for (const path of [
      "../External.md",
      ".obsidian/private.md",
      "CoForge/Public/board.md",
      "CoForge/Ideas/../Other.md",
    ]) {
      expect(() =>
        parseAtomicCommand(
          JSON.stringify({
            ...journal,
            notes: [{ ...journal.notes[0], path }],
          }),
          f.app.vault.configDir,
          readId,
        ),
      ).toThrow();
    }
    expect(() =>
      parseAtomicCommand(
        JSON.stringify({ ...journal, afterData: "{}" }),
        f.app.vault.configDir,
        readId,
      ),
    ).toThrow();
    expect(() =>
      parseAtomicCommand(
        JSON.stringify({
          ...journal,
          notes: [{ ...journal.notes[0], id: "CF-999" }],
        }),
        f.app.vault.configDir,
        readId,
      ),
    ).toThrow();
    expect(f.kit.read(f.file.path)).toBe(journal.notes[0]!.before);
  } finally {
    await f.studio.stop();
  }
});

it("accepts a durable journal write that threw after writing and commits exactly one note/data outcome", async () => {
  const f = await atomicExistingFixture();
  const journal = preparedJournal(f);
  const commit = new VaultCommandCommit(
    f.plugin,
    f.storage.dataPath,
    (bytes) => readIdeaNote(bytes)?.id,
  );
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(
    async (path, bytes) => {
      await write(path, bytes);
      if (path === commit.journalPath)
        throw new Error("Intent wrote then threw");
    },
  );
  try {
    await commit.commit(journal);
    expect(f.kit.read(f.storage.dataPath)).toBe(journal.afterData);
    expect(f.kit.read(f.file.path)).toBe(journal.notes[0]!.after);
    expect(await f.app.vault.adapter.exists(commit.journalPath)).toBe(false);
  } finally {
    vi.restoreAllMocks();
    await f.studio.stop();
  }
});

it("retains committed ledger evidence when a note effect is missing or indistinguishable from a human revert", async () => {
  const f = await atomicExistingFixture(); const journal = preparedJournal(f);
  const commit = new VaultCommandCommit(f.plugin, f.storage.dataPath, bytes => readIdeaNote(bytes)?.id);
  try {
    await f.app.vault.adapter.write(commit.journalPath, JSON.stringify(journal));
    await f.app.vault.adapter.write(f.storage.dataPath, journal.afterData);
    // The original bytes do not prove that the paid vote's note effect survived.
    await expect(new VaultStudioStorage(f.plugin).load()).rejects.toThrow(/recovery/i);
    expect(f.kit.read(f.file.path)).toBe(journal.notes[0]!.before);
    expect(f.kit.read(f.storage.dataPath)).toBe(journal.afterData);
    expect(f.kit.read(commit.journalPath)).toBe(JSON.stringify(journal));
  } finally { await f.studio.stop(); }
});
