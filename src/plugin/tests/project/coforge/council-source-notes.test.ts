import { describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { createTestApp } from "@test/obsidian";
import { App, type TFile } from "obsidian";
import {
  CouncilSourceNotes,
  readCouncilSource,
  writeCouncilSubmission,
} from "../../../infrastructure/coforge/council-source-notes";
import { executionContributionBlock } from "../../../features/coforge/domain/execution-projection";
import type {
  ExecutionArtifact,
  ExecutionRun,
} from "../../../features/coforge/domain/execution-run";
import { contextEventId } from "../../../features/coforge/domain/integrity";

const human =
  '---\r\nowner: "Keep quoted" # human annotation\r\ntags: [one, two]\r\n---\r\n# Proposal\r\n\r\nKeep **these bytes**.\r\n';
const metadata = {
  schema: "submission/v1" as const,
  id: "source-one",
  generation: 0,
  draft: false,
  ready: false,
};
function runFixture(): { run: ExecutionRun; artifact: ExecutionArtifact } {
  const run: ExecutionRun = {
    id: "run",
    submissionKey: "key",
    subject: {
      kind: "note",
      sourceId: metadata.id,
      revision: "rev",
      markdown: human,
    },
    projectId: "project",
    teamId: "team",
    context: "",
    invocations: [],
    cursor: 0,
    state: "publishing",
    attempts: [],
    artifacts: [],
    createdAt: "2026-10-28T12:00:00Z",
    updatedAt: "2026-10-28T12:00:00Z",
  };
  const artifact: ExecutionArtifact = {
    id: "artifact",
    runId: "run",
    invocationId: "invoke",
    attemptId: "attempt",
    roundId: "opinion",
    agentId: "architect",
    agentRevision: "a1",
    provider: "demo",
    model: "demo",
    inputArtifactIds: [],
    createdAt: "2026-10-28T12:00:00Z",
    markdown: "An opinion.",
    simulated: true,
  };
  run.artifacts.push(artifact);
  return { run, artifact };
}
describe("stable source notes and v2 projections", () => {
  it("honors ordinary Draft/Ready properties, excludes controls from snapshots and updates UI state without touching other bytes", async () => {
    const app = new App();
    createTestApp({ app });
    const original =
      '---\r\nDraft: true # keep comment\r\nReady: false\r\ncustom: "keep quoted"\r\n---\r\nHuman task.\r\n';
    const file = await app.vault.create("Task.md", original);
    const source = new CouncilSourceNotes(app.vault, () => []);
    const first = await source.identify(await source.read(file.path));
    expect(first).toMatchObject({
      draft: true,
      ready: false,
      hasHumanContent: true,
    });
    const ready = await source.setState(file.path, {
      draft: false,
      ready: true,
    });
    expect(ready.sourceRevision).toBe(first.sourceRevision);
    expect(ready).toMatchObject({ draft: false, ready: true });
    const written = await app.vault.read(file);
    expect(written).toContain(
      'Draft: false # keep comment\r\nReady: true\r\ncustom: "keep quoted"',
    );
    expect(written.endsWith("Human task.\r\n")).toBe(true);
    expect(
      readCouncilSource(
        "---\nDraft: true\nReady: false\ntags: [one]\n---\n",
        "Empty.md",
        [],
      ).hasHumanContent,
    ).toBe(false);
  });
  it("rechecks the destination inside the atomic publication if a source moves into an export folder during a pending write", async () => {
    const app = new App();
    createTestApp({ app });
    await app.vault.createFolder("Private");
    await app.vault.createFolder("Public");
    const original = writeCouncilSubmission(human, metadata);
    const file = await app.vault.create("Private/Task.md", original);
    const { run, artifact } = runFixture();
    let release: () => void = () => undefined;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const source = new CouncilSourceNotes(
      {
        getAbstractFileByPath: (path) => app.vault.getAbstractFileByPath(path),
        read: (item) => app.vault.read(item),
        process: async (item: TFile, edit: (value: string) => string) => {
          await waiting;
          return app.vault.process(item, edit);
        },
      },
      () => [run],
      () => [],
      (path) => {
        if (path.startsWith("Public/"))
          throw new Error("Choose a private destination.");
      },
    );
    await source.index([file.path]);
    const publishing = source.project(run, artifact);
    await app.vault.rename(file, "Public/Task.md");
    source.renamed("Private/Task.md", file.path);
    release();
    await expect(publishing).rejects.toMatchObject({ code: "source-conflict" });
    expect(await app.vault.read(file)).toBe(original);
  });
  it("checks earlier managed contributions inside the final publication and preserves the edited block and unprojected result", async () => {
    const app = new App();
    createTestApp({ app });
    const { run, artifact } = runFixture();
    const original = `${writeCouncilSubmission(human, metadata)}\n${executionContributionBlock(run, artifact)}\n`;
    const file = await app.vault.create("Task.md", original);
    const source = new CouncilSourceNotes(app.vault, () => [run]);
    await source.index([file.path]);
    const second = {
      ...artifact,
      id: "second",
      attemptId: "second-attempt",
      markdown: "Second result.",
    };
    run.artifacts.push(second);
    const edited = original.replace("An opinion.", "Human correction.");
    await app.vault.modify(file, edited);
    await expect(source.project(run, second)).rejects.toMatchObject({
      code: "source-conflict",
    });
    expect(await app.vault.read(file)).toBe(edited);
    expect(run.artifacts).toContain(second);
  });
  it("retains exact contribution fingerprints after history pruning so old notes stay readable without replay", () => {
    const { run, artifact } = runFixture();
    const block = executionContributionBlock(run, artifact);
    const markdown = `${writeCouncilSubmission(human, metadata)}\n${block}\n`;
    const tombstones = [
      {
        sourceId: metadata.id,
        artifactId: artifact.id,
        blockHash: contextEventId(block),
      },
    ];
    expect(
      readCouncilSource(markdown, "Task.md", [], tombstones).body,
    ).not.toContain("An opinion.");
    expect(() =>
      readCouncilSource(
        markdown.replace("An opinion.", "Edited."),
        "Task.md",
        [],
        tombstones,
      ),
    ).toThrow("conflict");
  });
  it("does not emit another vault modification when identity is already assigned", async () => {
    const app = new App();
    createTestApp({ app });
    const file = await app.vault.create("Task.md", "Original task.");
    const source = new CouncilSourceNotes(app.vault, () => []);
    let modifications = 0;
    const ref = app.vault.on("modify", () => {
      modifications++;
    });
    const candidate = await source.identify(await source.read(file.path));
    await source.identify(candidate);
    await source.identify(candidate);
    expect(modifications).toBe(1);
    app.vault.offref(ref);
  });
  it("adds identity and changes generation without touching unrelated YAML or human body", () => {
    const written = writeCouncilSubmission(human, metadata);
    expect(written).toContain(
      'owner: "Keep quoted" # human annotation\r\ntags: [one, two]',
    );
    expect(
      written.endsWith("# Proposal\r\n\r\nKeep **these bytes**.\r\n"),
    ).toBe(true);
    const parsed = readCouncilSource(written, "Inbox/Proposal.md", []);
    expect(parsed).toMatchObject({
      sourceId: "source-one",
      generation: 0,
      draft: false,
    });
    expect(
      readCouncilSource(
        writeCouncilSubmission(written, { ...metadata, generation: 1 }),
        "Inbox/Proposal.md",
        [],
      ).generation,
    ).toBe(1);
    expect(() =>
      writeCouncilSubmission(written, { ...metadata, id: "other" }),
    ).toThrow("identity");
    expect(() =>
      readCouncilSource("---\nfoo: 1\nfoo: 2\n---\nbody", "Inbox/Bad.md", []),
    ).toThrow("frontmatter");
  });
  it("excludes exact journal-backed projections from input and rejects edited/forged blocks", () => {
    const { run, artifact } = runFixture();
    const marked = writeCouncilSubmission(human, metadata);
    const before = readCouncilSource(marked, "Inbox/Proposal.md", []);
    const after = readCouncilSource(
      `${marked}\n${executionContributionBlock(run, artifact)}\n`,
      "Inbox/Proposal.md",
      [run],
    );
    expect(after.sourceRevision).toBe(before.sourceRevision);
    expect(after.body).not.toContain("An opinion.");
    expect(() =>
      readCouncilSource(
        `${marked}\n${executionContributionBlock(run, artifact).replace("An opinion.", "My edit.")}\n`,
        "Inbox/Proposal.md",
        [run],
      ),
    ).toThrow("conflict");
    expect(() =>
      readCouncilSource(
        `${marked}\n<!-- coforge:v2:forged:begin -->fake<!-- coforge:v2:forged:end -->`,
        "Inbox/Proposal.md",
        [run],
      ),
    ).toThrow("Unknown");
  });
  it("follows renames, publishes once atomically, and retains results when source is deleted", async () => {
    const app = new App();
    createTestApp({ app });
    await app.vault.createFolder("Inbox");
    const file = await app.vault.create(
      "Inbox/Proposal.md",
      writeCouncilSubmission(human, metadata),
    );
    const { run, artifact } = runFixture();
    const source = new CouncilSourceNotes(app.vault, () => [run]);
    await source.index([file.path]);
    await app.vault.rename(file, "Inbox/Moved.md");
    source.renamed("Inbox/Proposal.md", file.path);
    await source.project(run, artifact);
    await source.project(run, artifact);
    expect(
      (await app.vault.read(file)).match(/coforge:v2:artifact:begin/gu),
    ).toHaveLength(1);
    await app.vault.delete(file);
    source.removed(file.path);
    await expect(source.project(run, artifact)).rejects.toMatchObject({
      code: "source-missing",
    });
    expect(app.vault.getAbstractFileByPath("Inbox/Moved.md")).toBeNull();
  });
  it("publishes to an explicitly reassigned identity without replacing the original captured source", async () => {
    const app = new App();
    createTestApp({ app });
    const target = await app.vault.create(
      "Recovery.md",
      writeCouncilSubmission("Human recovery annotation.\n", {
        ...metadata,
        id: "recovery-source",
      }),
    );
    const { run, artifact } = runFixture();
    run.projectionTarget = {
      sourceId: "recovery-source",
      acknowledgedAt: "2026-10-28T12:10:00Z",
    };
    const source = new CouncilSourceNotes(app.vault, () => [run]);
    await source.index([target.path]);
    await source.project(run, artifact);
    await source.project(run, artifact);
    const projected = await app.vault.read(target);
    expect(projected).toContain("Human recovery annotation.");
    expect(projected).toContain("An opinion.");
    expect(readCouncilSource(projected, target.path, [run]).body).not.toContain(
      "An opinion.",
    );
    expect(run.subject.markdown).toBe(human);
    expect(run.subject.sourceId).toBe("source-one");
  });
});
