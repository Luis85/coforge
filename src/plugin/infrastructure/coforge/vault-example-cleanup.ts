import { createHash, randomUUID } from 'node:crypto';
import type { Plugin, TFile } from 'obsidian';

const ROOTS = { examples: 'CoForge/Recovery/ExampleCleanup', request: 'CoForge/Recovery/RequestDeletion' };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
interface ArchivedNote { id: string; original: string; staged: string; fingerprint: string }
interface CleanupJournal { schema: 1; directory: string; beforeData: string | null; afterHash: string; notes: ArchivedNote[]; committed?: boolean }
const failure = () => new Error('The cleanup preview is stale or its recovery files changed. Refresh the preview; all retained notes are preserved.');

/** Durable, exact-target removal. Interrupted preparation rolls back before canonical notes are loaded. */
export class VaultExampleCleanup {
  readonly writing = new Set<string>();
  warning: string | undefined;
  private reloadRequired = false;
  constructor(private readonly plugin: Plugin, private readonly dataPath: string, private readonly readId: (content: string) => string | undefined, private readonly candidates: () => readonly TFile[], private readonly intent: 'examples' | 'request' = 'examples') {}
  private get root() { return ROOTS[this.intent]; }
  private get journalPath() { return this.dataPath.replace(/coforge-state\.json$/u, this.intent === 'request' ? 'coforge-request-deletion.json' : 'coforge-example-cleanup.json'); }
  private stagedPath(directory: string, index: number, original: string) { return this.intent === 'request' ? `${directory}/${index}/${original.slice(original.lastIndexOf('/') + 1)}` : `${directory}/${index}.coforge-archive`; }
  private get vault() { return this.plugin.app.vault; }
  private recoveryCopy(note: ArchivedNote) { return `${note.staged.slice(0, note.staged.lastIndexOf('/'))}/request.coforge-recovery`; }
  private async retainRequestCopy(note: ArchivedNote, content: string): Promise<void> {
    if (this.intent !== 'request') return;
    const path = this.recoveryCopy(note);
    if (!await this.vault.adapter.exists(path)) await this.vault.adapter.write(path, content);
    if (hash(await this.vault.adapter.read(path)) !== note.fingerprint) throw failure();
  }

  async preview(ids: readonly string[], file: (id: string) => TFile | null): Promise<Record<string, string>> {
    const fingerprints: Record<string, string> = {};
    if (!ids.length) return fingerprints;
    const identities = new Map<string, number>();
    for (const note of this.candidates()) {
      let id: string | undefined;
      try { id = this.readId(await this.vault.read(note)); } catch { continue; }
      if (id) identities.set(id, (identities.get(id) ?? 0) + 1);
    }
    for (const id of ids) {
      const target = file(id);
      if (!target) throw failure();
      const content = await this.vault.read(target);
      if (this.readId(content) !== id) throw failure();
      if (identities.get(id) !== 1) throw new Error('Two notes use a cleanup request ID. Restore unique IDs before reviewing cleanup.');
      fingerprints[id] = hash(content);
    }
    return fingerprints;
  }

  async remove(notes: Record<string, string>, file: (id: string) => TFile | null, afterData: string): Promise<void> {
    this.warning = undefined;
    await this.recover();
    if (this.intent === 'request' && await this.vault.adapter.exists(this.journalPath))
      throw new Error('A previously deleted note still needs trash recovery. Restore trash access or inspect CoForge/Recovery/RequestDeletion, then reload before deleting another request.');
    const current = await this.preview(Object.keys(notes), file);
    if (Object.keys(notes).some(id => current[id] !== notes[id])) throw failure();
    const directory = `${this.root}/${randomUUID()}`;
    const journal: CleanupJournal = {
      schema: 1, directory,
      beforeData: await this.vault.adapter.exists(this.dataPath) ? await this.vault.adapter.read(this.dataPath) : null,
      afterHash: hash(afterData), notes: [],
    };
    for (const [id, fingerprint] of Object.entries(notes)) {
      const target = file(id);
      if (!target || hash(await this.vault.read(target)) !== fingerprint) throw failure();
      journal.notes.push({ id, original: target.path, staged: this.stagedPath(directory, journal.notes.length, target.path), fingerprint });
    }
    this.parse(JSON.stringify(journal));
    await this.ensureDirectory(directory);
    for (const note of journal.notes) await this.ensureDirectory(note.staged.slice(0, note.staged.lastIndexOf('/')));
    await this.vault.adapter.write(this.journalPath, JSON.stringify(journal));
    for (const note of journal.notes) { this.writing.add(note.original); this.writing.add(note.staged); }
    try {
      for (const note of journal.notes) {
        const target = file(note.id);
        if (!target || hash(await this.vault.read(target)) !== note.fingerprint) throw failure();
        await this.vault.rename(target, note.staged);
        if (hash(await this.vault.adapter.read(note.staged)) !== note.fingerprint) throw failure();
      }
      // Catch edits made through a still-open file while another target was being staged.
      for (const note of journal.notes)
        if (hash(await this.vault.adapter.read(note.staged)) !== note.fingerprint) throw failure();
      for (const target of this.candidates()) {
        let id: string | undefined;
        try { id = this.readId(await this.vault.read(target)); } catch { continue; }
        if (id && Object.hasOwn(notes, id)) throw failure();
      }
      try { await this.vault.adapter.write(this.dataPath, afterData); }
      catch (error) {
        // Adapter failures may leave a truncated file: restore its exact previous bytes first.
        try {
          if (journal.beforeData !== null) await this.vault.adapter.write(this.dataPath, journal.beforeData);
          else if (await this.vault.adapter.exists(this.dataPath)) await this.vault.adapter.remove(this.dataPath);
        } catch {
          this.reloadRequired = true;
          throw new Error('Cleanup could not confirm its data write or rollback. Recovery files are preserved. Reload CoForge before another change.');
        }
        throw error;
      }
    } catch (error) {
      if (this.reloadRequired) throw error;
      await this.restore(journal);
      await this.vault.adapter.remove(this.journalPath);
      throw error;
    } finally {
      this.writing.clear();
    }
    // The plugin-data commit is authoritative. A trash failure must not reject that committed transaction.
    await this.finish(journal);
  }

  async recover(): Promise<void> {
    if (!await this.vault.adapter.exists(this.journalPath)) return;
    const journal = this.parse(await this.vault.adapter.read(this.journalPath));
    const data = await this.vault.adapter.exists(this.dataPath) ? await this.vault.adapter.read(this.dataPath) : null;
    if (journal.committed || (data !== null && hash(data) === journal.afterHash)) { await this.finish(journal); this.reloadRequired = false; return; }
    if (data !== journal.beforeData) throw new Error('Interrupted example cleanup needs inspection in the private recovery folder. Canonical notes and recovery files were preserved.');
    for (const note of journal.notes) { this.writing.add(note.original); this.writing.add(note.staged); }
    try { await this.restore(journal); await this.vault.adapter.remove(this.journalPath); this.reloadRequired = false; }
    finally { this.writing.clear(); }
  }

  async settleBeforeSave(): Promise<void> {
    if (this.reloadRequired) throw new Error('Reload CoForge to reconcile the interrupted cleanup before another change. Recovery files are preserved.');
    await this.recover();
    if (await this.vault.adapter.exists(this.journalPath) && !this.parse(await this.vault.adapter.read(this.journalPath)).committed)
      throw new Error('A committed cleanup recovery receipt could not be saved. Restore private recovery-folder access before making another change.');
  }

  private async restore(journal: CleanupJournal): Promise<void> {
    for (const note of [...journal.notes].reverse()) {
      const staged = this.vault.getFileByPath(note.staged);
      const original = this.vault.getFileByPath(note.original);
      if (original && staged) throw new Error('A cleanup target was recreated. Both versions are preserved; inspect the private recovery folder before continuing.');
      if (staged) await this.vault.rename(staged, note.original);
      else if (!original) throw failure();
    }
  }

  private async finish(journal: CleanupJournal): Promise<void> {
    this.warning = undefined;
    let retained = false;
    journal.committed = true;
    try { await this.vault.adapter.write(this.journalPath, JSON.stringify(journal)); } catch { retained = true; }
    for (const note of journal.notes) {
      try {
        const file = this.vault.getFileByPath(note.staged);
        if (!file) continue;
        const content = await this.vault.read(file);
        if (hash(content) !== note.fingerprint) { retained = true; continue; }
        // Preserve exact bytes even when the user's Obsidian preference is permanent deletion.
        await this.retainRequestCopy(note, content);
        if (hash(await this.vault.read(file)) !== note.fingerprint) { retained = true; continue; }
        await this.plugin.app.fileManager.trashFile(file);
      } catch { retained = true; }
    }
    let receipt = false;
    try {
      // Keep a private receipt so retained archive bytes can be matched to their original note paths.
      const notes = this.intent === 'request' ? journal.notes.map(note => ({ ...note, recoveryCopy: this.recoveryCopy(note) })) : journal.notes;
      await this.vault.adapter.write(`${journal.directory}/receipt.json`, JSON.stringify({ schema: 1, notes, retained }, null, 2));
      receipt = true;
    } catch { retained = true; }
    const pending = journal.notes.some(note => this.vault.getFileByPath(note.staged));
    if (!pending || receipt && !(this.intent === 'request' && retained)) {
      try { await this.vault.adapter.remove(this.journalPath); } catch { retained = true; }
    }
    if (retained) this.warning = this.intent === 'request'
      ? 'Deletion committed. The note remains in CoForge/Recovery/RequestDeletion for recovery because trash was unavailable or the archived note changed.'
      : 'Cleanup committed. Some notes remain in CoForge/Recovery/ExampleCleanup for manual recovery because the vault trash was unavailable or an archived note changed.';
  }

  private async ensureDirectory(path: string): Promise<void> {
    let current = '';
    for (const segment of path.split('/')) {
      current = current ? `${current}/${segment}` : segment;
      if (!await this.vault.adapter.exists(current)) await this.vault.createFolder(current);
    }
  }

  private parse(content: string): CleanupJournal {
    const value: unknown = JSON.parse(content);
    if (!value || typeof value !== 'object' || !('schema' in value) || value.schema !== 1 || !('directory' in value) || typeof value.directory !== 'string'
      || !new RegExp(`^${this.root}/[a-f0-9-]{36}$`, 'u').test(value.directory)
      || !('beforeData' in value) || (value.beforeData !== null && typeof value.beforeData !== 'string')
      || !('afterHash' in value) || typeof value.afterHash !== 'string' || !/^[a-f0-9]{64}$/u.test(value.afterHash)
      || !('notes' in value) || !Array.isArray(value.notes) || value.notes.length > 10000) throw failure();
    if ('committed' in value && typeof value.committed !== 'boolean') throw failure();
    const directory = value.directory;
    const notes: ArchivedNote[] = value.notes.map((note: unknown, index: number) => {
      if (!note || typeof note !== 'object' || !('id' in note) || typeof note.id !== 'string' || !/^CF-\d+$/u.test(note.id)
        || !('original' in note) || typeof note.original !== 'string' || !/^[^/:\\]+(?:\/[^/:\\]+)*\.md$/iu.test(note.original)
        || note.original.split('/').some(segment => segment === '..' || segment === '.' || /[\p{Cc}*?"<>|]/u.test(segment))
        || note.original.toLowerCase().startsWith(`${this.plugin.app.vault.configDir.toLowerCase()}/`) || note.original.toLowerCase().startsWith('.git/')
        || !('staged' in note) || note.staged !== this.stagedPath(directory, index, note.original)
        || !('fingerprint' in note) || typeof note.fingerprint !== 'string' || !/^[a-f0-9]{64}$/u.test(note.fingerprint)) throw failure();
      return { id: note.id, original: note.original, staged: note.staged, fingerprint: note.fingerprint };
    });
    if (new Set(notes.map(note => note.original)).size !== notes.length || new Set(notes.map(note => note.id)).size !== notes.length) throw failure();
    return { schema: 1, directory, beforeData: value.beforeData, afterHash: value.afterHash, notes, committed: 'committed' in value && value.committed === true };
  }
}
