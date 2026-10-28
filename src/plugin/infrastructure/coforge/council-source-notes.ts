import { TFile, type Plugin, type Vault } from "obsidian";
import { contextEventId } from "../../features/coforge/domain/integrity";
import { ExecutionBlockError } from "../../features/coforge/domain/execution-block";
import type { IntakeCandidate } from "../../features/coforge/domain/intake-bindings";
import type {
  ExecutionArtifact,
  ExecutionRun,
  ExecutionProjectionTombstone,
} from "../../features/coforge/domain/execution-run";
import {
  executionContributionBlock,
  projectExecutionContribution,
} from "../../features/coforge/domain/execution-projection";
import {
  parseSourceDocument,
  sourceWithoutIdentity,
  writeCouncilSubmission,
  writeCouncilSubmissionState,
} from "./council-source-format";
export { writeCouncilSubmission } from "./council-source-format";

/** Locate retained sources from the host's metadata index; unrelated note bodies are never read. */
export async function indexCouncilRunSources(
  plugin: Plugin,
  sources: CouncilSourceNotes,
  runs: readonly ExecutionRun[],
): Promise<void> {
  const identities = new Set(
    runs.flatMap((run) => [
      run.subject.sourceId,
      ...(run.projectionTarget ? [run.projectionTarget.sourceId] : []),
    ]),
  );
  await sources.index(
    plugin.app.vault
      .getMarkdownFiles()
      .filter((file) => {
        const metadata: unknown =
          plugin.app.metadataCache.getFileCache(file)?.frontmatter
            ?.coforge_submission;
        return (
          metadata !== null &&
          typeof metadata === "object" &&
          "id" in metadata &&
          typeof metadata.id === "string" &&
          identities.has(metadata.id)
        );
      })
      .map((file) => file.path),
  );
}

/** Strip only exact journal-backed blocks; editable Markdown never manufactures trusted results. */
export function readCouncilSource(
  markdown: string,
  path: string,
  runs: readonly ExecutionRun[],
  projections: readonly ExecutionProjectionTombstone[] = [],
): IntakeCandidate {
  const parsed = parseSourceDocument(markdown);
  let human = sourceWithoutIdentity(parsed);
  for (const run of runs.filter(
    (item) =>
      item.subject.sourceId === parsed.metadata?.id ||
      item.projectionTarget?.sourceId === parsed.metadata?.id,
  ))
    for (const artifact of run.artifacts) {
      const block = executionContributionBlock(run, artifact);
      const start = `<!-- coforge:v2:${artifact.id}:begin -->`;
      const end = `<!-- coforge:v2:${artifact.id}:end -->`;
      if (!human.includes(start) && !human.includes(end)) continue;
      if (
        !human.includes(block) ||
        human.indexOf(start) !== human.lastIndexOf(start) ||
        human.indexOf(end) !== human.lastIndexOf(end)
      )
        throw new Error(
          "Source publication conflict: a managed result was edited. Keep both versions and inspect the recorded result.",
        );
      human = human.replace(block, "");
    }
  for (const projection of projections.filter(
    (item) => item.sourceId === parsed.metadata?.id,
  )) {
    const start = `<!-- coforge:v2:${projection.artifactId}:begin -->`;
    const end = `<!-- coforge:v2:${projection.artifactId}:end -->`;
    const first = human.indexOf(start);
    const last = human.indexOf(end, first);
    if (first < 0 && !human.includes(end)) continue;
    if (
      first < 0 ||
      last < 0 ||
      first !== human.lastIndexOf(start) ||
      human.indexOf(end) !== human.lastIndexOf(end)
    )
      throw new Error(
        "Publication conflict: a preserved contribution block is incomplete or duplicated.",
      );
    const block = human.slice(first, last + end.length);
    if (contextEventId(block) !== projection.blockHash)
      throw new Error(
        "Publication conflict: a preserved contribution was edited after history export.",
      );
    human = human.slice(0, first) + human.slice(last + end.length);
  }
  if (/<!--\s*coforge:v2:/iu.test(human))
    throw new Error(
      "Unknown managed contribution in the source. Inspect the note before admitting more work.",
    );
  return {
    path,
    ...(parsed.metadata ? { sourceId: parsed.metadata.id } : {}),
    generation: parsed.metadata?.generation ?? 0,
    body: human,
    hasHumanContent: Boolean(parseSourceDocument(human).body.trim()),
    sourceRevision: contextEventId(human.trimEnd()),
    draft: parsed.controls?.draft ?? parsed.metadata?.draft ?? false,
    ready: parsed.controls?.ready ?? parsed.metadata?.ready ?? false,
  };
}

/** Vault.process protects human edits between read and write. Paths are an index, never source identity. */
export class CouncilSourceNotes {
  private readonly sourcePaths = new Map<string, Set<string>>();
  constructor(
    private readonly vault: Pick<
      Vault,
      "getAbstractFileByPath" | "read" | "process"
    >,
    private readonly runs: () => readonly ExecutionRun[],
    private readonly projections: () => readonly ExecutionProjectionTombstone[] = () => [],
    private readonly assertDestination: (path: string) => void = () =>
      undefined,
  ) {}
  private file(path: string): TFile {
    const file = this.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md")
      throw new ExecutionBlockError("source-missing");
    return file;
  }
  private remember(note: IntakeCandidate): void {
    this.removed(note.path);
    if (!note.sourceId) return;
    const paths = this.sourcePaths.get(note.sourceId) ?? new Set<string>();
    paths.add(note.path);
    this.sourcePaths.set(note.sourceId, paths);
  }
  async read(path: string): Promise<IntakeCandidate> {
    const file = this.file(path);
    const markdown = await this.vault.read(file);
    try {
      const metadata = parseSourceDocument(markdown).metadata;
      if (metadata)
        this.remember({
          path,
          sourceId: metadata.id,
          generation: metadata.generation,
          body: "",
          sourceRevision: "invalid",
          draft: metadata.draft,
          ready: metadata.ready,
        });
      const note = readCouncilSource(
        markdown,
        path,
        this.runs(),
        this.projections(),
      );
      this.remember(note);
      return note;
    } catch {
      throw new ExecutionBlockError("source-conflict");
    }
  }
  async index(paths: readonly string[]): Promise<void> {
    for (const path of paths) {
      try {
        await this.read(path);
      } catch {
        /* Invalid sources stay unavailable; retain any observed identity for duplicate detection. */
      }
    }
  }
  async identify(
    candidate: IntakeCandidate,
  ): Promise<IntakeCandidate & { sourceId: string }> {
    const file = this.file(candidate.path);
    const observed = await this.vault.read(file);
    const currentMetadata = parseSourceDocument(observed).metadata;
    if (currentMetadata) {
      if (candidate.sourceId && candidate.sourceId !== currentMetadata.id)
        throw new Error(
          "The source identity changed; inspect the current note before admission.",
        );
      const note = {
        ...readCouncilSource(
          observed,
          file.path,
          this.runs(),
          this.projections(),
        ),
        sourceId: currentMetadata.id,
      };
      this.remember(note);
      return note;
    }
    let sourceId = "";
    const markdown = await this.vault.process(file, (current) => {
      const parsed = parseSourceDocument(current);
      if (candidate.sourceId && candidate.sourceId !== parsed.metadata?.id)
        throw new Error(
          "The source identity changed; inspect the current note before admission.",
        );
      sourceId = parsed.metadata?.id ?? `source-${crypto.randomUUID()}`;
      return parsed.metadata
        ? current
        : writeCouncilSubmission(current, {
            schema: "submission/v1",
            id: sourceId,
            generation: 0,
            draft: false,
            ready: false,
          });
    });
    const note = {
      ...readCouncilSource(
        markdown,
        file.path,
        this.runs(),
        this.projections(),
      ),
      sourceId,
    };
    this.remember(note);
    return note;
  }
  resolve(sourceId: string): string {
    const paths = this.sourcePaths.get(sourceId);
    if (!paths?.size) throw new ExecutionBlockError("source-missing");
    if (paths.size > 1) throw new ExecutionBlockError("source-missing");
    return [...paths][0]!;
  }
  knownIdentity(path: string): string | undefined {
    for (const [id, paths] of this.sourcePaths) if (paths.has(path)) return id;
    return undefined;
  }
  privateFolders(): string[] {
    return [
      ...new Set(
        [...this.sourcePaths.values()].flatMap((paths) =>
          [...paths]
            .map((path) => path.split("/").slice(0, -1).join("/"))
            .filter(Boolean),
        ),
      ),
    ];
  }
  async project(run: ExecutionRun, artifact: ExecutionArtifact): Promise<void> {
    const targetId = run.projectionTarget?.sourceId ?? run.subject.sourceId;
    const file = this.file(this.resolve(targetId));
    this.assertDestination(file.path);
    await this.vault.process(file, (current) => {
      try {
        this.assertDestination(file.path);
        if (parseSourceDocument(current).metadata?.id !== targetId)
          throw new ExecutionBlockError("source-conflict");
        readCouncilSource(current, file.path, this.runs(), this.projections());
        return projectExecutionContribution(current, run, artifact);
      } catch {
        throw new ExecutionBlockError("source-conflict");
      }
    });
  }
  async runAgain(sourceId: string): Promise<IntakeCandidate> {
    const file = this.file(this.resolve(sourceId));
    await this.vault.process(file, (current) => {
      const parsed = parseSourceDocument(current);
      if (parsed.metadata?.id !== sourceId)
        throw new Error("The source identity changed.");
      return writeCouncilSubmission(current, {
        ...parsed.metadata,
        generation: parsed.metadata.generation + 1,
      });
    });
    return this.read(file.path);
  }
  async setState(
    path: string,
    state: { draft: boolean; ready: boolean },
  ): Promise<IntakeCandidate> {
    if (typeof state.draft !== "boolean" || typeof state.ready !== "boolean")
      throw new Error("Draft and Ready must be booleans.");
    const file = this.file(path);
    this.assertDestination(file.path);
    await this.vault.process(file, (current) => {
      this.assertDestination(file.path);
      const parsed = parseSourceDocument(current);
      return writeCouncilSubmissionState(current, {
        schema: "submission/v1",
        id: parsed.metadata?.id ?? `source-${crypto.randomUUID()}`,
        generation: parsed.metadata?.generation ?? 0,
        draft: state.draft,
        ready: state.ready,
      });
    });
    return this.read(file.path);
  }
  renamed(oldPath: string, newPath: string): void {
    for (const paths of this.sourcePaths.values()) {
      const previousPaths = [...paths];
      for (const path of previousPaths)
        if (path === oldPath || path.startsWith(`${oldPath}/`)) {
          paths.delete(path);
          paths.add(newPath + path.slice(oldPath.length));
        }
    }
  }
  removed(path: string): void {
    for (const [id, paths] of this.sourcePaths) {
      for (const known of paths)
        if (known === path || known.startsWith(`${path}/`)) paths.delete(known);
      if (!paths.size) this.sourcePaths.delete(id);
    }
  }
}
