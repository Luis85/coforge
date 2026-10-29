// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { CouncilCatalogue } from "../../../features/coforge/application/council-catalogue";
import { StudioService } from "../../../features/coforge/application/studio";
import { ExecutionKernel } from "../../../features/coforge/application/execution-kernel";
import { workflowV2Dispatch } from "../../../features/coforge/application/workflow-v2-execution";
import { reviewedWorkflowIdentity } from "../../../features/coforge/application/reviewed-preflight";
import { emptyExecutionJournal } from "../../../features/coforge/domain/execution-run";
import { VaultStudioStorage } from "../../../infrastructure/coforge/vault-storage";
import {
  VaultCouncilDefinitions,
  DEFAULT_COUNCIL_FOLDERS,
} from "../../../infrastructure/coforge/vault-council-definitions";
import { CouncilSourceNotes } from "../../../infrastructure/coforge/council-source-notes";
import { CouncilWorkflowModule } from "../../../infrastructure/coforge/council-workflow-module";
import { VaultWorkflowOutputTemplates } from "../../../infrastructure/coforge/vault-workflow-output-templates";
import { nodeTimers } from "./memory-storage";
import { CouncilRunContext } from '../../../infrastructure/coforge/council-run-context';
import { CouncilMessagingModule } from '../../../infrastructure/coforge/council-messaging-module';

it("invalidates reviewed v2 preflight after a Markdown template edit and keeps admitted content after deletion", async () => {
  const app = new App();
  const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const studio = new StudioService(new VaultStudioStorage(plugin), {
    timers: nodeTimers(),
    runners: {
      demo: async () => ({ markdown: "Unused" }),
      claude: async () => ({ markdown: "Unused" }),
    },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  try {
    await studio.start();
    const project = await studio.createProject({
      projectName: "Template project",
      projectBrief: "Analyze proposals",
      projectPath: "/synthetic/project",
    });
    const templates = new VaultWorkflowOutputTemplates(
      plugin,
      async () => undefined,
      (id) => {
        if (id !== project.id) throw new Error("Wrong project");
      },
    );
    const saved = await templates.save(project.id, {
      name: "Answer",
      markdown: "# Original\n\n## Evidence",
    });
    const catalogue = new CouncilCatalogue(
      new VaultCouncilDefinitions(
        plugin,
        DEFAULT_COUNCIL_FOLDERS,
        async () => undefined,
      ),
    );
    await catalogue.save({
      schema: "agent/v1",
      id: "analyst",
      name: "Analyst",
      enabled: true,
      role: "Review",
      instructions: "Analyze",
      provider: "demo",
      model: "sonnet",
      contextSources: [],
      requestedCapabilities: { project: "none", messaging: false },
    });
    await catalogue.save({
      schema: "team/v1",
      id: "team",
      name: "Team",
      enabled: true,
      projectId: project.id,
      members: ["analyst"],
      pinnedContext: [],
      recentMessages: 10,
      allowedRecipients: [],
    });
    let journal = emptyExecutionJournal();
    const sources = new CouncilSourceNotes(app.vault, () => journal.runs);
    const instructions: string[] = [];
    const kernel = new ExecutionKernel({
      journal: {
        load: async () => journal,
        save: async (next) => {
          journal = structuredClone(next);
        },
      },
      now: () => "2026-10-29T12:00:00.000Z",
      id: () => crypto.randomUUID(),
      assertEligible: async () => undefined,
      resolveInvocation: workflowV2Dispatch,
      invoke: async (_run, invocation) => {
        instructions.push(invocation.instructions);
        return { markdown: "# Answer\n\nEvidence", simulated: true };
      },
      publish: (run, artifact) => sources.project(run, artifact),
    });
    await kernel.load();
    const messaging = new CouncilMessagingModule(plugin, kernel, catalogue, async () => undefined, async () => { throw new Error('Unexpected admission'); });
    const context = new CouncilRunContext(plugin, studio, sources, catalogue, messaging, () => undefined, () => undefined, () => false);
    expect(() => context.sourcePath(`CoForge/Output Templates/${project.id}/${saved.id}.md`)).toThrow(/source|template|definition/i);
    expect(context.sourcePath('Private/Proposal.md')).toBe('Private/Proposal.md');
    const workflows = new CouncilWorkflowModule(
      plugin,
      studio,
      kernel,
      sources,
      catalogue,
      async () => undefined,
      () => undefined,
      undefined,
      templates,
    );
    await workflows.actions.save(
      project.id,
      {
        format: "coforge-workflow/v2",
        revision: "draft",
        name: "Analyze",
        teamId: "team",
        subjectMode: "note",
        limits: {
          timeoutSeconds: 180,
          maxTurns: 12,
          maxBudgetUsd: 1,
          maxInvocations: 10,
        },
        collections: [],
        steps: [
          {
            kind: "agent",
            id: "analysis",
            name: "Analyze",
            instructions: "Review",
            agentId: "analyst",
            access: "none",
            output: "markdown",
            inputs: [],
            outputTemplateId: saved.id,
          },
        ],
      },
      "",
    );
    await app.vault.createFolder("Private");
    const source = await app.vault.create(
      "Private/Proposal.md",
      "Human proposal",
    );
    const first = await workflows.actions.preflight(
      project.id,
      source.path,
      true,
    );
    expect(first.plan.catalogue.outputTemplates).toEqual([saved]);
    expect(instructions).toEqual([]);
    const changed = await templates.save(
      project.id,
      { ...saved, markdown: "# Updated\n\n## Evidence" },
      saved.revision,
    );
    await expect(
      workflows.actions.start(
        project.id,
        source.path,
        true,
        "CoForge/Tests/Rejected.md",
        reviewedWorkflowIdentity(first),
      ),
    ).rejects.toThrow(/preflight/i);
    expect(app.vault.getFileByPath("CoForge/Tests/Rejected.md")).toBeNull();
    expect(journal.runs).toEqual([]);
    const current = await workflows.actions.preflight(
      project.id,
      source.path,
      true,
    );
    const run = await workflows.actions.start(
      project.id,
      source.path,
      true,
      "CoForge/Tests/Accepted.md",
      reviewedWorkflowIdentity(current),
    );
    await templates.remove(project.id, changed.id, changed.revision);
    kernel.resume();
    await kernel.step(run.id);
    expect(instructions).toHaveLength(1);
    expect(instructions[0]).toContain(changed.markdown);
    expect(journal.runs[0]?.state).toBe("completed");
    await expect(
      workflows.actions.preflight(project.id, source.path, true),
    ).rejects.toThrow(/template/i);
    expect(kit.errors).toEqual([]);
  } finally {
    await studio.stop();
  }
});
