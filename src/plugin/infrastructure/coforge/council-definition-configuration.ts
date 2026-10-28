import type { CouncilFolderActions } from "../../features/coforge/application/council-catalogue";
import type { CouncilPreferences } from "../../features/coforge/application/council-ports";
import {
  validateIntakeBindings,
  type IntakeFolderPolicy,
} from "../../features/coforge/domain/intake-bindings";
import type { VaultCouncilDefinitions } from "./vault-council-definitions";

interface DefinitionConfigurationHost {
  preferences(): CouncilPreferences;
  folderPolicy(): IntakeFolderPolicy;
  assertExecutor(): Promise<void>;
  protect(paths: string[]): Promise<void>;
  save(value: CouncilPreferences): Promise<void>;
  publish(): void;
}
/** Folder changes select discovery/write locations; they never move a user's definitions. */
export function councilDefinitionConfiguration(
  storage: VaultCouncilDefinitions,
  host: DefinitionConfigurationHost,
): CouncilFolderActions {
  const preview: CouncilFolderActions["preview"] = async (folders) => {
    const result = await storage.previewFolders(folders);
    validateIntakeBindings(host.preferences().bindings, {
      ...host.folderPolicy(),
      definitionFolders: Object.values(result.folders),
    });
    return result;
  };
  return {
    preview,
    configure: async (folders, revision) => {
      await host.assertExecutor();
      if (revision !== host.preferences().revision)
        throw new Error(
          "Definition folder settings changed. Preview the current configuration before saving.",
        );
      const result = await preview(folders);
      await host.protect(Object.values(result.folders));
      await host.save({
        ...host.preferences(),
        definitionFolders: result.folders,
      });
      host.publish();
    },
  };
}
