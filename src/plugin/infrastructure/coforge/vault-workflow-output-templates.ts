import type { Plugin, TFile } from "obsidian";
import type {
  WorkflowOutputTemplateActions,
  WorkflowOutputTemplateCatalogue,
} from "../../features/coforge/application/workflow-output-templates";
import {
  WORKFLOW_OUTPUT_TEMPLATES_FOLDER,
  outputTemplateIdCheck,
  workflowOutputTemplateInputCheck,
  type WorkflowOutputTemplate,
  type WorkflowOutputTemplateInput,
} from "../../features/coforge/domain/workflow-output-templates";
import { vaultFoldersOverlap } from "../../features/coforge/domain/vault-folder-policy";
import {
  readWorkflowOutputTemplateNote,
  writeWorkflowOutputTemplateNote,
} from "./workflow-output-template-notes";

/** Stable IDs survive filenames; exact whole-note revisions protect external edits. */
export class VaultWorkflowOutputTemplates implements WorkflowOutputTemplateActions {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly plugin: Plugin,
    private readonly protect: (paths: string[]) => Promise<void>,
    private readonly assertProject: (projectId: string) => void,
    private readonly publicFolder: () => string = () => "CoForge/Public",
  ) {}
  private folder(projectId: string): string {
    outputTemplateIdCheck(projectId);
    this.assertProject(projectId);
    const folder = `${WORKFLOW_OUTPUT_TEMPLATES_FOLDER}/${projectId}`;
    if (
      [
        this.publicFolder(),
        "CoForge/Public",
        this.plugin.app.vault.configDir,
        ".git",
      ].some((path) => vaultFoldersOverlap(folder, path))
    )
      throw new Error("Output templates must stay in a private vault folder.");
    return folder;
  }
  private async scan(projectId: string): Promise<{
    catalogue: WorkflowOutputTemplateCatalogue;
    files: Map<string, TFile>;
  }> {
    const folder = this.folder(projectId);
    const candidates: { template: WorkflowOutputTemplate; file: TFile }[] = [];
    const invalid: WorkflowOutputTemplateCatalogue["invalid"] = [];
    for (const file of this.plugin.app.vault
      .getMarkdownFiles()
      .filter((item) => item.path.startsWith(folder + "/"))) {
      try {
        const template = readWorkflowOutputTemplateNote(
          await this.plugin.app.vault.read(file),
        );
        if (template.projectId !== projectId)
          throw new Error("Project mismatch");
        candidates.push({ template, file });
      } catch {
        invalid.push({
          path: file.path,
          reason:
            "Repair this template’s metadata, project identity or Markdown before using it.",
        });
      }
    }
    const templates: WorkflowOutputTemplate[] = [];
    const files = new Map<string, TFile>();
    const counts = new Map<string, number>();
    for (const candidate of candidates)
      counts.set(
        candidate.template.id,
        (counts.get(candidate.template.id) ?? 0) + 1,
      );
    for (const candidate of candidates) {
      if (counts.get(candidate.template.id) !== 1)
        invalid.push({
          path: candidate.file.path,
          reason:
            "Duplicate template identity. Give the copy a new identity before using it.",
        });
      else {
        templates.push(candidate.template);
        files.set(candidate.template.id, candidate.file);
      }
    }
    return {
      catalogue: {
        templates: templates.sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
        invalid,
      },
      files,
    };
  }
  async list(projectId: string): Promise<WorkflowOutputTemplateCatalogue> {
    await this.tail;
    return (await this.scan(projectId)).catalogue;
  }
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.tail.then(work);
    this.tail = pending.catch(() => undefined);
    return pending;
  }
  save(
    projectId: string,
    value: WorkflowOutputTemplateInput,
    expectedRevision?: string,
  ): Promise<WorkflowOutputTemplate> {
    return this.serialize(async () => {
      const folder = this.folder(projectId);
      const input = workflowOutputTemplateInputCheck(value);
      const id = input.id ?? crypto.randomUUID();
      const scanned = await this.scan(projectId);
      const existing = scanned.files.get(id);
      await this.protect([WORKFLOW_OUTPUT_TEMPLATES_FOLDER]);
      let content: string;
      if (existing) {
        content = await this.plugin.app.vault.process(existing, (current) => {
          this.folder(projectId);
          if (!existing.path.startsWith(folder + "/"))
            throw new Error(
              "The output template moved. Refresh before saving.",
            );
          const previous = readWorkflowOutputTemplateNote(current);
          if (
            previous.id !== id ||
            previous.projectId !== projectId ||
            expectedRevision === undefined ||
            previous.revision !== expectedRevision
          )
            throw new Error(
              "The output template changed externally. Refresh before saving; your draft is preserved.",
            );
          return writeWorkflowOutputTemplateNote(current, projectId, id, input);
        });
      } else {
        if (expectedRevision !== undefined || input.id)
          throw new Error(
            "The output template is missing or invalid. Refresh before saving; your draft is preserved.",
          );
        const segments = folder.split("/");
        for (let index = 1; index <= segments.length; index++) {
          const parent = segments.slice(0, index).join("/");
          if (!this.plugin.app.vault.getAbstractFileByPath(parent))
            await this.plugin.app.vault.createFolder(parent);
        }
        content = writeWorkflowOutputTemplateNote("", projectId, id, input);
        this.folder(projectId);
        await this.plugin.app.vault.create(`${folder}/${id}.md`, content);
      }
      return readWorkflowOutputTemplateNote(content);
    });
  }
  remove(
    projectId: string,
    id: string,
    expectedRevision: string,
  ): Promise<void> {
    return this.serialize(async () => {
      const folder = this.folder(projectId);
      outputTemplateIdCheck(id);
      const file = (await this.scan(projectId)).files.get(id);
      if (!file)
        throw new Error(
          "The output template is missing or invalid. Refresh before deleting.",
        );
      const targetPath = file.path;
      await this.protect([WORKFLOW_OUTPUT_TEMPLATES_FOLDER]);
      let validated = "";
      await this.plugin.app.vault.process(file, (current) => {
        this.folder(projectId);
        const template = readWorkflowOutputTemplateNote(current);
        if (
          file.path !== targetPath ||
          !file.path.startsWith(folder + "/") ||
          template.id !== id ||
          template.projectId !== projectId ||
          template.revision !== expectedRevision
        )
          throw new Error(
            "The output template changed externally. Refresh before deleting; the note is preserved.",
          );
        validated = current;
        return current;
      });
      // Obsidian has no compare-and-trash primitive. Recheck the exact note and
      // target after the process lease; never trash a renamed/replaced file.
      if ((await this.plugin.app.vault.read(file)) !== validated)
        throw new Error(
          "The output template changed before deletion. Refresh; its current note is preserved.",
        );
      this.folder(projectId);
      if (
        file.path !== targetPath ||
        !file.path.startsWith(folder + "/") ||
        this.plugin.app.vault.getFileByPath(file.path) !== file
      )
        throw new Error(
          "The output template moved before deletion. Refresh; the note is preserved.",
        );
      await this.plugin.app.fileManager.trashFile(file);
    });
  }
  async open(projectId: string, id: string): Promise<void> {
    await this.tail;
    const folder = this.folder(projectId);
    outputTemplateIdCheck(id);
    const file = (await this.scan(projectId)).files.get(id);
    if (
      !file ||
      !file.path.startsWith(folder + "/") ||
      this.plugin.app.vault.getFileByPath(file.path) !== file
    )
      throw new Error(
        "The output template is missing or invalid. Refresh before opening.",
      );
    await this.plugin.app.workspace.openLinkText(file.path, "", false);
  }
}
