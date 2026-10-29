import { councilIdeaContextBlock } from "../../features/coforge/application/council-linked-idea";
import type { CouncilRunContext } from "./council-run-context";
import { TFile, type Plugin } from "obsidian";
import { parseDocument, stringify } from "yaml";
import type {
  CouncilTaskNotes,
  CouncilTaskRecord,
} from "../../features/coforge/application/council-tasks";
import {
  COUNCIL_TASK_FOLDER,
  councilTaskMetadataCheck,
  type CouncilTaskMetadata,
} from "../../features/coforge/domain/council-task";
import { record } from "../../features/coforge/domain/check";
import { vaultFoldersOverlap } from "../../features/coforge/domain/vault-folder-policy";
import type { IntakeBinding } from "../../features/coforge/domain/intake-bindings";
import {
  parseSourceDocument,
  writeCouncilSubmission,
} from "./council-source-format";
import type { CouncilSourceNotes } from "./council-source-notes";

interface Host {
  assertReady(): void;
  assertSource(path: string): void;
  bindings(): readonly IntakeBinding[];
  protect(paths: string[]): Promise<void>;
  sources: CouncilSourceNotes;
  validateLink?(
    metadata: CouncilTaskMetadata,
    path: string,
    markdown: string,
  ): Promise<void>;
  registerLink?(metadata: CouncilTaskMetadata, markdown: string): Promise<void>;
}
function document(metadata: CouncilTaskMetadata, question: string): string {
  const frontmatter = stringify({ coforge_task: metadata }, { lineWidth: 0 });
  return writeCouncilSubmission(
    `---\n${frontmatter}---\n# ${metadata.title}\n\n${question}`,
    {
      schema: "submission/v1",
      id: `task-${metadata.idempotencyKey}`,
      generation: 0,
      draft: false,
      ready: false,
    },
  );
}
function readTask(
  path: string,
  markdown: string,
): { task: CouncilTaskRecord; metadata: CouncilTaskMetadata } {
  const parsed = parseSourceDocument(markdown);
  const metadata = councilTaskMetadataCheck(
    record(parseDocument(parsed.yaml).toJS({ maxAliasCount: 0 })).coforge_task,
  );
  if (
    !parsed.metadata ||
    parsed.metadata.id !== `task-${metadata.idempotencyKey}`
  )
    throw new Error(
      "A saved Council task has a missing or conflicting submission identity. Repair its note before continuing.",
    );
  return {
    metadata,
    task: {
      path,
      sourceId: parsed.metadata.id,
      projectId: metadata.projectId,
      target: metadata.target,
      title: metadata.title,
      createdAt: metadata.createdAt,
      ...(metadata.linkedIdea ? { linkedIdea: metadata.linkedIdea } : {}),
    },
  };
}

/** Canonical private task notes; deterministic paths and exact comparison make retries safe. */
export class VaultCouncilTaskNotes implements CouncilTaskNotes {
  constructor(
    private readonly plugin: Plugin,
    private readonly host: Host,
  ) {}
  private assertPrivate() {
    this.host.assertReady();
    this.host.assertSource(COUNCIL_TASK_FOLDER);
  }
  async create(
    input: CouncilTaskMetadata,
    question: string,
  ): Promise<CouncilTaskRecord> {
    const metadata = councilTaskMetadataCheck(input);
    this.assertPrivate();
    if (
      this.host
        .bindings()
        .some((binding) =>
          vaultFoldersOverlap(binding.path, COUNCIL_TASK_FOLDER),
        )
    )
      throw new Error(
        "Move watched inboxes away from the private Council task folder before saving. Saving a task must not start execution.",
      );
    const path = `${COUNCIL_TASK_FOLDER}/task-${metadata.idempotencyKey}.md`;
    const retainedTask = (await this.list()).find(
      (task) => task.sourceId === `task-${metadata.idempotencyKey}`,
    );
    const existing = this.plugin.app.vault.getAbstractFileByPath(
      retainedTask?.path ?? path,
    );
    if (existing) {
      if (!(existing instanceof TFile))
        throw new Error(
          "The task destination conflicts with an existing folder.",
        );
      const current = await this.plugin.app.vault.read(existing);
      const retained = readTask(existing.path, current);
      let expectedQuestion = question;
      if (metadata.linkedIdea) {
        if (!this.host.validateLink)
          throw new Error("Linked request evidence is unavailable.");
        await this.host.validateLink(retained.metadata, existing.path, current);
        expectedQuestion = question.replace(
          councilIdeaContextBlock(question),
          councilIdeaContextBlock(current),
        );
      }
      const expected = document(
        { ...metadata, createdAt: retained.metadata.createdAt },
        expectedQuestion,
      );
      if (current !== expected)
        throw new Error(
          "This saved task or its draft content changed. Open the existing note; it was not overwritten and no duplicate was created.",
        );
      this.host.assertReady();
      if (existing.path !== path) this.host.sources.removed(path);
      await this.host.sources.read(existing.path);
      return retained.task;
    }
    await this.host.protect([COUNCIL_TASK_FOLDER]);
    this.assertPrivate();
    const markdown = document(metadata, question);
    if (metadata.linkedIdea) {
      if (!this.host.registerLink)
        throw new Error("Linked request evidence is unavailable.");
      await this.host.registerLink(metadata, markdown);
    }
    await this.plugin.app.vault.create(path, markdown);
    await this.host.sources.read(path);
    return readTask(path, markdown).task;
  }
  async list(): Promise<CouncilTaskRecord[]> {
    this.assertPrivate();
    const files = this.plugin.app.vault
      .getMarkdownFiles()
      .filter((file) =>
        file.path
          .toLowerCase()
          .startsWith(COUNCIL_TASK_FOLDER.toLowerCase() + "/"),
      );
    const tasks: CouncilTaskRecord[] = [];
    for (const file of files) {
      this.host.assertSource(file.path);
      const markdown = await this.plugin.app.vault.read(file);
      this.host.assertReady();
      tasks.push(readTask(file.path, markdown).task);
    }
    if (new Set(tasks.map((task) => task.sourceId)).size !== tasks.length)
      throw new Error(
        "Saved Council tasks contain duplicate source identities. Repair the conflicting notes before continuing.",
      );
    return tasks.sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        a.sourceId.localeCompare(b.sourceId),
    );
  }
}

export function createCouncilTaskNotes(
  plugin: Plugin,
  context: CouncilRunContext,
  sources: CouncilSourceNotes,
  bindings: Host["bindings"],
  assertReady: Host["assertReady"],
  protect: Host["protect"],
): VaultCouncilTaskNotes {
  return new VaultCouncilTaskNotes(plugin, {
    assertReady,
    protect,
    bindings,
    sources,
    assertSource: (path) => {
      context.sourcePath(path);
    },
    validateLink: async (metadata, path, markdown) => {
      await context.linkedIdeas.validate(
        path,
        `task-${metadata.idempotencyKey}`,
        metadata.projectId,
        markdown,
      );
    },
    registerLink: (metadata, markdown) =>
      context.linkedIdeas.register(
        `task-${metadata.idempotencyKey}`,
        metadata.projectId,
        metadata.linkedIdea!,
        markdown,
      ),
  });
}
