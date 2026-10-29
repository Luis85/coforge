import type { ManagedNoteFolderPolicy } from '../../features/coforge/application/ports';
import { vaultFoldersOverlap } from '../../features/coforge/domain/vault-folder-policy';

/** A reservation spans filesystem work and state publication, so both configuration orders are safe. */
export class ManagedNoteFolders implements ManagedNoteFolderPolicy {
  private readonly pending = new Map<symbol, readonly string[]>();
  constructor(private readonly serviceDesignFolders: () => readonly string[]) {}

  assertAvailable(folders: readonly string[]): void {
    if (folders.some(folder => this.serviceDesignFolders().some(root => vaultFoldersOverlap(folder, root))))
      throw new Error('Keep other managed note folders separate from current and retained Service Design folders.');
  }
  reserve(folders: readonly string[]): () => void {
    this.assertAvailable(folders);
    if (this.pending.size >= 100) throw new Error('Too many folder changes are pending. Wait for them to finish, then try again.');
    const token = Symbol();
    this.pending.set(token, [...folders]);
    return () => { this.pending.delete(token); };
  }
  privateFolders(): readonly string[] {
    return [...new Set([...this.pending.values()].flat())];
  }
}
