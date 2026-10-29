import type { Plugin, TFile } from "obsidian";
import { parseDocument } from "yaml";
import type { StudioService } from "../../features/coforge/application/studio";
import {
  captureCouncilIdea,
  councilIdeaRevision,
  COUNCIL_IDEA_START,
  councilIdeaContextBlock as contextBlock,
} from "../../features/coforge/application/council-linked-idea";
import {
  linkedCouncilIdeaCheck,
  type LinkedCouncilIdea,
} from "../../features/coforge/domain/council-linked-idea";
import { list, oneOf, shape, text } from "../../features/coforge/domain/check";
import {
  ideaFingerprint,
  contextEventId,
} from "../../features/coforge/domain/integrity";
import { readIdeaNote } from "./vault-storage";
import { parseSourceDocument } from "./council-source-format";

const entryCheck = shape(
  {
    sourceId: text({ min: 1, max: 200 }),
    path: text({ min: 1, max: 1000 }),
    projectId: text({ min: 1, max: 200 }),
    linkedIdea: linkedCouncilIdeaCheck,
    contextHash: text({ min: 1, max: 200 }),
    mode: oneOf(["task", "simulation"]),
  },
  { strict: true },
);
const registryCheck = shape(
  {
    format: oneOf(["coforge-council-idea-links/v1"]),
    entries: list(entryCheck, { max: 10000 }),
  },
  { strict: true },
);
type Entry = ReturnType<typeof entryCheck>;
/** Private source anchors prevent removing editable task metadata from bypassing request screening. */
export class CouncilIdeaLinks {
  private readonly path: string;
  constructor(
    private readonly plugin: Plugin,
    private readonly studio: StudioService,
    private readonly ideaFile?: (id: string) => TFile | null,
  ) {
    this.path = `${plugin.manifest.dir ?? `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`}/coforge-council-idea-links.json`;
  }
  private async entries(): Promise<Entry[]> {
    const adapter = this.plugin.app.vault.adapter;
    if (!(await adapter.exists(this.path))) return [];
    const entries = registryCheck(
      JSON.parse(await adapter.read(this.path)),
    ).entries;
    if (new Set(entries.map((item) => item.sourceId)).size !== entries.length)
      throw new Error(
        "Linked request identities conflict. Repair private Council evidence before continuing.",
      );
    return entries;
  }
  async capture(link: LinkedCouncilIdea, projectId: string): Promise<string> {
    const checked = linkedCouncilIdeaCheck(link);
    const selected = this.studio.store
      .internalSnapshot()
      .ideas.find((item) => item.id === checked.ideaId);
    if (!selected) throw new Error("The linked request is unavailable.");
    const file = this.ideaFile?.(selected.id);
    if (!file)
      throw new Error(
        "The canonical request note is unavailable. Restore it before asking the Council.",
      );
    const note = readIdeaNote(await this.plugin.app.vault.read(file));
    const state = this.studio.store.internalSnapshot();
    const idea = state.ideas.find((item) => item.id === checked.ideaId);
    if (!idea) throw new Error("The linked request is unavailable.");
    if (
      !note ||
      note.id !== idea.id ||
      ideaFingerprint(note) !== ideaFingerprint(idea) ||
      councilIdeaRevision({ ...idea, ...note }) !== councilIdeaRevision(idea)
    )
      throw new Error(
        "The canonical request changed. Reconcile and screen it before asking the Council.",
      );
    return captureCouncilIdea(
      idea,
      state.integrity[idea.id],
      projectId,
      checked.revision,
    ).context;
  }
  async register(
    sourceId: string,
    projectId: string,
    link: LinkedCouncilIdea,
    markdown: string,
    mode: Entry["mode"] = "task",
    path = `CoForge/CouncilTasks/${sourceId}.md`,
  ): Promise<void> {
    await this.capture(link, projectId);
    const context = contextBlock(markdown);
    const entry: Entry = {
      sourceId,
      path,
      projectId,
      linkedIdea: link,
      contextHash: contextEventId(context),
      mode,
    };
    const entries = await this.entries();
    const existing = entries.find((item) => item.sourceId === sourceId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(entry))
      throw new Error(
        "This task's linked request identity changed. Start a new assessment instead.",
      );
    if (existing) return;
    const adapter = this.plugin.app.vault.adapter;
    let folder = "";
    for (const segment of this.path.split("/").slice(0, -1)) {
      folder = folder ? folder + "/" + segment : segment;
      if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
    }
    const next = registryCheck({ format: "coforge-council-idea-links/v1", entries: [...entries, entry] });
    await adapter.write(this.path, JSON.stringify(next));
  }
  async assertCaptured(
    sourceId: string,
    projectId: string,
    link: LinkedCouncilIdea,
    markdown: string,
  ): Promise<void> {
    const anchor = (await this.entries()).find(
      (item) => item.sourceId === sourceId,
    );
    if (
      !anchor ||
      anchor.projectId !== projectId ||
      JSON.stringify(anchor.linkedIdea) !== JSON.stringify(link) ||
      contextEventId(contextBlock(markdown)) !== anchor.contextHash
    )
      throw new Error(
        "The captured request assessment evidence is unavailable or changed. Create a fresh assessment.",
      );
    await this.capture(link, projectId);
  }
  async validate(
    path: string,
    sourceId: string | undefined,
    projectId: string,
    markdown: string,
  ): Promise<LinkedCouncilIdea | undefined> {
    const entries = await this.entries();
    const anchor = entries.find(
      (item) =>
        item.sourceId === sourceId ||
        item.path.toLowerCase() === path.toLowerCase(),
    );
    const file = this.plugin.app.vault.getFileByPath(path);
    if (!file) throw new Error("The source note is unavailable.");
    const parsed = parseSourceDocument(await this.plugin.app.vault.read(file));
    const yaml: unknown = parseDocument(parsed.yaml).toJS({ maxAliasCount: 0 });
    const task =
      yaml && typeof yaml === "object"
        ? Reflect.get(yaml, "coforge_task")
        : undefined;
    const rawLink =
      task && typeof task === "object"
        ? Reflect.get(task, "linkedIdea")
        : undefined;
    if (!anchor) {
      if (rawLink !== undefined || markdown.includes(COUNCIL_IDEA_START))
        throw new Error(
          "This request assessment has no trusted source identity. Reopen Send to the Council from its card.",
        );
      return undefined;
    }
    if (anchor.projectId !== projectId)
      throw new Error("The linked request belongs to another project.");
    if (
      anchor.mode === "task" &&
      (sourceId !== anchor.sourceId ||
        !task ||
        typeof task !== "object" ||
        Reflect.get(task, "projectId") !== anchor.projectId)
    )
      throw new Error(
        "The task's linked request identity or project changed. Restore it or create a fresh assessment.",
      );
    if (
      anchor.mode === "task" &&
      (rawLink === undefined ||
        JSON.stringify(linkedCouncilIdeaCheck(rawLink)) !==
          JSON.stringify(anchor.linkedIdea))
    )
      throw new Error(
        "The task's linked request metadata changed. Restore it or create a fresh assessment.",
      );
    await this.capture(anchor.linkedIdea, projectId);
    if (contextEventId(contextBlock(markdown)) !== anchor.contextHash)
      throw new Error(
        "The linked request context changed. Create a fresh assessment from its card.",
      );
    return anchor.linkedIdea;
  }
}
