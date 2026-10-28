import type { Vault, TFile } from "obsidian";
import type { WorkflowV2Definition } from "../../features/coforge/domain/configured-workflow-v2";
import { PROJECTS_FOLDER } from "../../features/coforge/domain/projects";
import type { StoredWorkflowV2 } from "../../features/coforge/application/workflow-v2-ports";
import { readProjectNote } from "./vault-projects";
import { readWorkflowV2Note, writeWorkflowV2Note } from "./workflow-v2-notes";

/** V2 is a separate reserved property; saving it never replaces a legacy v1 workflow. */
export class VaultWorkflowV2 {
  constructor(
    private readonly vault: Pick<
      Vault,
      "getMarkdownFiles" | "read" | "process"
    >,
    private readonly projectFile?: (id: string) => TFile | null,
  ) {}
  private async file(projectId: string): Promise<TFile> {
    if (this.projectFile) {
      const file = this.projectFile(projectId);
      if (
        !file ||
        !file.path.startsWith(`${PROJECTS_FOLDER}/`) ||
        readProjectNote(await this.vault.read(file))?.id !== projectId
      )
        throw new Error(
          "The canonical project note is missing, moved or changed identity. Repair it before editing workflow v2.",
        );
      return file;
    }
    const found: TFile[] = [];
    for (const file of this.vault
      .getMarkdownFiles()
      .filter((item) => item.path.startsWith(`${PROJECTS_FOLDER}/`))) {
      const project = readProjectNote(await this.vault.read(file));
      if (project?.id === projectId) found.push(file);
    }
    if (found.length !== 1)
      throw new Error(
        "The canonical project note is missing or has a duplicate identity. Repair it before editing workflow v2.",
      );
    return found[0]!;
  }
  async load(projectId: string): Promise<StoredWorkflowV2> {
    return readWorkflowV2Note(
      await this.vault.read(await this.file(projectId)),
    );
  }
  async save(
    projectId: string,
    definition: WorkflowV2Definition,
    expectedRevision = "",
  ): Promise<StoredWorkflowV2> {
    const file = await this.file(projectId);
    const content = await this.vault.process(file, (markdown) => {
      if (!file.path.startsWith(`${PROJECTS_FOLDER}/`))
        throw new Error(
          "The canonical project note moved outside its private project folder.",
        );
      if (readProjectNote(markdown)?.id !== projectId)
        throw new Error("The project identity changed before saving.");
      return writeWorkflowV2Note(markdown, definition, expectedRevision);
    });
    return readWorkflowV2Note(content);
  }
}
