import type { CouncilFolderActions } from "../../features/coforge/application/council-catalogue";
import type { CouncilPreferences } from "../../features/coforge/application/council-ports";
import {
  validateIntakeBindings,
  type IntakeFolderPolicy,
} from "../../features/coforge/domain/intake-bindings";
import type { VaultCouncilDefinitions } from "./vault-council-definitions";
import { DEFAULT_COUNCIL_FOLDERS } from '../../features/coforge/domain/council-definition-folders';
import type { CouncilStateStorage } from './council-state-storage';
import type { ManagedNoteFolderPolicy } from '../../features/coforge/application/ports';

interface DefinitionConfigurationHost {
  preferences(): CouncilPreferences;
  folderPolicy(): IntakeFolderPolicy;
  assertExecutor(): Promise<void>;
  protect(paths: string[]): Promise<void>;
  save(value: CouncilPreferences): Promise<void>;
  publish(): void;
}

/** Recheck reservations after filesystem protection, immediately before preferences commit. */
export async function saveCouncilPreferences(
  value: CouncilPreferences,
  current: CouncilPreferences,
  storage: Pick<CouncilStateStorage, 'savePreferences'>,
  protect: () => Promise<void>,
  assertNoteFoldersAvailable: (folders: readonly string[]) => void,
): Promise<CouncilPreferences> {
  const next = { ...value, revision: current.revision + 1 };
  await protect();
  assertNoteFoldersAvailable(Object.values(next.definitionFolders ?? DEFAULT_COUNCIL_FOLDERS));
  await storage.savePreferences(next, current.revision);
  return next;
}
/** Folder changes select discovery/write locations; they never move a user's definitions. */
export function councilDefinitionConfiguration(
  storage: VaultCouncilDefinitions,
  host: DefinitionConfigurationHost,
  noteFolders: Partial<ManagedNoteFolderPolicy> = {},
): CouncilFolderActions {
  const preview: CouncilFolderActions["preview"] = async (folders) => {
    noteFolders.assertAvailable?.(Object.values(folders));
    const result = await storage.previewFolders(folders);
    noteFolders.assertAvailable?.(Object.values(result.folders));
    validateIntakeBindings(host.preferences().bindings, {
      ...host.folderPolicy(),
      definitionFolders: Object.values(result.folders),
    });
    return result;
  };
  return {
    preview,
    configure: async (folders, revision) => {
      const release = noteFolders.reserve?.(Object.values(folders));
      try {
        await host.assertExecutor();
        if (revision !== host.preferences().revision)
          throw new Error(
            "Definition folder settings changed. Preview the current configuration before saving.",
          );
        const result = await preview(folders);
        await host.protect(Object.values(result.folders));
        noteFolders.assertAvailable?.(Object.values(result.folders));
        await host.save({
          ...host.preferences(),
          definitionFolders: result.folders,
        });
        host.publish();
      } finally { release?.(); }
    },
  };
}
