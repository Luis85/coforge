import type { Plugin } from "obsidian";
import {
  commandRecoveryFailure,
  parseAtomicCommand,
  type AtomicCommandJournal,
  type AtomicCommandNote,
} from "./atomic-command-format";

/** Private redo/undo evidence spans all note effects and the authoritative command ledger commit. */
export class VaultCommandCommit {
  readonly writing = new Set<string>();
  private uncertain = false;
  private cleanupPending = false;
  constructor(
    private readonly plugin: Plugin,
    private readonly dataPath: string,
    private readonly readId: (content: string) => string | undefined,
  ) {}
  get journalPath(): string {
    return this.dataPath.replace(
      /coforge-state\.json$/u,
      "coforge-command-commit.json",
    );
  }
  private get vault() {
    return this.plugin.app.vault;
  }
  private async data(): Promise<string | null> {
    return (await this.vault.adapter.exists(this.dataPath))
      ? this.vault.adapter.read(this.dataPath)
      : null;
  }
  private async note(path: string): Promise<string | null> {
    const file = this.vault.getFileByPath(path);
    if (file) return this.vault.read(file);
    if (
      this.vault.getAbstractFileByPath(path) ||
      (await this.vault.adapter.exists(path))
    )
      throw commandRecoveryFailure();
    return null;
  }
  private parse(content: string) {
    return parseAtomicCommand(content, this.vault.configDir, this.readId);
  }
  private mark(journal: AtomicCommandJournal) {
    for (const note of journal.notes) {
      this.writing.add(note.path);
      if (note.rollbackPath) this.writing.add(note.rollbackPath);
    }
  }
  private async finish(): Promise<boolean> {
    try {
      if (await this.vault.adapter.exists(this.journalPath))
        await this.vault.adapter.remove(this.journalPath);
      this.cleanupPending = false;
      return true;
    } catch {
      let present = true;
      try {
        present = await this.vault.adapter.exists(this.journalPath);
      } catch {
        /* Preserve commit success when receipt diagnostics also fail. */
      }
      this.cleanupPending = present;
      return !present;
    }
  }
  async settleBeforeSave(): Promise<void> {
    if (this.uncertain) throw commandRecoveryFailure();
    await this.recover();
    if (
      this.cleanupPending ||
      (await this.vault.adapter.exists(this.journalPath))
    )
      throw commandRecoveryFailure();
  }
  async recover(): Promise<void> {
    if (!(await this.vault.adapter.exists(this.journalPath))) {
      this.cleanupPending = false;
      return;
    }
    let journal: AtomicCommandJournal;
    try {
      journal = this.parse(await this.vault.adapter.read(this.journalPath));
    } catch {
      this.uncertain = true;
      throw commandRecoveryFailure();
    }
    const data = await this.data();
    if (data === journal.afterData) {
      // Preserve human edits, but do not discard the receipt when a note effect may have been lost.
      for (const note of journal.notes) {
        const current = await this.note(note.path);
        if (current === null || (current === note.before && note.before !== note.after) || this.readId(current) !== note.id) {
          this.uncertain = true; throw commandRecoveryFailure();
        }
      }
      this.uncertain = false;
      await this.finish();
      return;
    }
    if (data !== journal.beforeData) {
      this.uncertain = true;
      throw commandRecoveryFailure();
    }
    this.mark(journal);
    try {
      await this.rollback(journal);
      if (!(await this.finish())) throw commandRecoveryFailure();
      this.uncertain = false;
    } catch {
      this.uncertain = true;
      throw commandRecoveryFailure();
    } finally {
      this.writing.clear();
    }
  }
  async commit(journal: AtomicCommandJournal): Promise<void> {
    await this.settleBeforeSave();
    const encoded = JSON.stringify(journal);
    this.parse(encoded);
    if ((await this.data()) !== journal.beforeData)
      throw commandRecoveryFailure();
    for (const note of journal.notes)
      if ((await this.note(note.path)) !== note.before)
        throw new Error(
          "A request note changed before this command. Refresh before retrying; no fee or reward was committed.",
        );
    // No note is touched until exact durable recovery evidence has been confirmed.
    try {
      await this.vault.adapter.write(this.journalPath, encoded);
    } catch (error) {
      if (!(await this.vault.adapter.exists(this.journalPath))) throw error;
      if ((await this.vault.adapter.read(this.journalPath)) !== encoded) {
        this.uncertain = true;
        throw commandRecoveryFailure();
      }
    }
    if ((await this.vault.adapter.read(this.journalPath)) !== encoded) {
      this.uncertain = true;
      throw commandRecoveryFailure();
    }
    this.mark(journal);
    let failure: unknown;
    try {
      for (const note of journal.notes) await this.apply(note);
      for (const note of journal.notes)
        if ((await this.note(note.path)) !== note.after)
          throw commandRecoveryFailure();
      if ((await this.data()) !== journal.beforeData)
        throw commandRecoveryFailure();
      await this.vault.adapter.write(this.dataPath, journal.afterData);
      if ((await this.data()) !== journal.afterData)
        throw commandRecoveryFailure();
    } catch (error) {
      failure = error;
    }
    try {
      const data = await this.data();
      if (data === journal.afterData) {
        await this.finish();
        return;
      }
      if (data !== journal.beforeData) {
        this.uncertain = true;
        throw commandRecoveryFailure();
      }
      await this.rollback(journal);
      if (!(await this.finish())) {
        this.uncertain = true;
        throw commandRecoveryFailure();
      }
      if (failure !== undefined) throw failure;
      throw commandRecoveryFailure();
    } catch (error) {
      // Rollback or an unknown data write must hold the journal through reload.
      if (await this.vault.adapter.exists(this.journalPath))
        this.uncertain = true;
      throw error;
    } finally {
      this.writing.clear();
    }
  }
  private async apply(note: AtomicCommandNote): Promise<void> {
    if (note.before === null) {
      if ((await this.note(note.path)) !== null) throw commandRecoveryFailure();
      await this.vault.create(note.path, note.after);
      return;
    }
    const file = this.vault.getFileByPath(note.path);
    if (!file) throw commandRecoveryFailure();
    await this.vault.process(file, (current) => {
      if (current !== note.before) throw commandRecoveryFailure();
      return note.after;
    });
  }
  private async archiveCreated(note: AtomicCommandNote): Promise<void> {
    if (!note.rollbackPath) throw commandRecoveryFailure();
    const file = this.vault.getFileByPath(note.path);
    if (!file || (await this.vault.read(file)) !== note.after)
      throw commandRecoveryFailure();
    let folder = "";
    for (const segment of note.rollbackPath.split("/").slice(0, -1)) {
      folder = folder ? folder + "/" + segment : segment;
      if (!this.vault.getAbstractFileByPath(folder))
        await this.vault.createFolder(folder);
    }
    try {
      await this.vault.rename(file, note.rollbackPath);
    } catch (error) {
      if (
        (await this.note(note.path)) !== null ||
        (await this.note(note.rollbackPath)) === null
      )
        throw error;
    }
    const archived = this.vault.getFileByPath(note.rollbackPath);
    if (!archived) throw commandRecoveryFailure();
    if ((await this.vault.read(archived)) !== note.after) {
      // A still-open editor changed the moved file. Preserve its bytes at the original path when vacant.
      if ((await this.note(note.path)) === null)
        await this.vault.rename(archived, note.path);
      throw commandRecoveryFailure();
    }
    // Retain the private archive: a later edit can never race with deletion/trashing.
  }
  private async rollback(journal: AtomicCommandJournal): Promise<void> {
    // Validate every target first. Conflicting human bytes are never overwritten.
    for (const note of journal.notes) {
      const current = await this.note(note.path);
      if (note.before === null && current === null) continue;
      if (current !== note.before && current !== note.after)
        throw commandRecoveryFailure();
      if (note.rollbackPath && (await this.note(note.rollbackPath)) !== null)
        throw commandRecoveryFailure();
    }
    for (const note of [...journal.notes].reverse()) {
      const current = await this.note(note.path);
      if (current === note.before) continue;
      if (current !== note.after) throw commandRecoveryFailure();
      const file = this.vault.getFileByPath(note.path);
      if (!file) throw commandRecoveryFailure();
      if (note.before === null) {
        await this.archiveCreated(note);
      } else {
        await this.vault.process(file, (value) => {
          if (value !== note.after) throw commandRecoveryFailure();
          return note.before!;
        });
      }
    }
    const archived: AtomicCommandNote[] = [];
    for (const note of journal.notes)
      if (
        note.rollbackPath &&
        (await this.vault.adapter.exists(note.rollbackPath))
      )
        archived.push(note);
    if (archived.length) {
      const receiptPath = `CoForge/Recovery/Commands/${journal.recoveryId}/receipt.json`;
      const receipt = JSON.stringify({
        format: "coforge-command-rollback/v1",
        notes: archived.map((note) => ({
          id: note.id,
          original: note.path,
          archived: note.rollbackPath,
        })),
      });
      if (await this.vault.adapter.exists(receiptPath)) {
        if ((await this.vault.adapter.read(receiptPath)) !== receipt)
          throw commandRecoveryFailure();
      } else {
        try {
          await this.vault.adapter.write(receiptPath, receipt);
        } catch (error) {
          if (
            !(await this.vault.adapter.exists(receiptPath)) ||
            (await this.vault.adapter.read(receiptPath)) !== receipt
          )
            throw error;
        }
      }
    }
  }
}
