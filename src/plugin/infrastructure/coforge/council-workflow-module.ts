import { workflowMessageRecipient } from "./workflow-message-recipient";
import { captureWorkflowOutputTemplates, type WorkflowOutputTemplateActions } from '../../features/coforge/application/workflow-output-templates';
import { WORKFLOW_OUTPUT_TEMPLATES_FOLDER } from '../../features/coforge/domain/workflow-output-templates';
import {
  readWorkflowNoteContext,
  type WorkflowContextOptions,
} from "./workflow-note-context";
import type { Plugin } from "obsidian";
import type { CouncilCatalogueActions } from "../../features/coforge/application/council-catalogue";
import type { StudioService } from "../../features/coforge/application/studio";
import type { ExecutionKernel } from "../../features/coforge/application/execution-kernel";
import {
  compileWorkflowV2,
  type WorkflowV2Catalogue,
} from "../../features/coforge/application/workflow-v2-compiler";
import { workflowV2Admission } from "../../features/coforge/application/workflow-v2-execution";
import type {
  WorkflowV2Actions,
  WorkflowV2Preview,
} from "../../features/coforge/application/workflow-v2-ports";
import {
  workflowV2DefinitionCheck,
  type WorkflowV2Definition,
} from "../../features/coforge/domain/configured-workflow-v2";
import type {
  AgentDefinition,
  CouncilDefinition,
} from "../../features/coforge/domain/council-definitions";
import type {
  ExecutionRun,
  ExecutionSubject,
} from "../../features/coforge/domain/execution-run";
import { intakeSubmissionKey } from "../../features/coforge/domain/intake-bindings";
import {
  normalizeVaultFolder,
  vaultFoldersOverlap,
} from "../../features/coforge/domain/vault-folder-policy";
import type { CouncilSourceNotes } from "./council-source-notes";
import { VaultWorkflowV2 } from "./vault-workflow-v2";
import { DEFAULT_COUNCIL_FOLDERS } from "./vault-council-definitions";
import { readIdeaNote } from "./vault-storage";
import type { MessageRecipient } from "../../features/coforge/domain/team-messages";
import { assertReviewedWorkflowIdentity } from "../../features/coforge/application/reviewed-preflight";
import { attachAutomationEvent } from '../../features/coforge/application/automation-admission';
import type { AutomationContext } from '../../features/coforge/domain/automation-context';
import {
  captureInvocationProject,
  projectInvocationInstructions,
  type InvocationProjectContext,
} from "../../features/coforge/application/invocation-project-context";

/** Explicit v2 composition uses the existing journal and provider lane. V1 project settings remain canonical. */
export class CouncilWorkflowModule {
  readonly actions: WorkflowV2Actions;
  private readonly storage: VaultWorkflowV2;
  constructor(
    private readonly plugin: Plugin,
    private readonly studio: StudioService,
    private readonly kernel: ExecutionKernel,
    private readonly sources: CouncilSourceNotes,
    private readonly catalogue: CouncilCatalogueActions,
    private readonly protect: (paths: string[]) => Promise<void>,
    private readonly assertExecutor: () => Promise<void> | void,
    private readonly contextOptions?: WorkflowContextOptions,
    private readonly outputTemplates?: WorkflowOutputTemplateActions,
  ) {
    this.storage = new VaultWorkflowV2(
      plugin.app.vault,
      contextOptions?.projectFile,
    );
    this.actions = {
      load: (id) => this.storage.load(id),
      save: async (id, definition, expected) => {
        await this.assertExecutor();
        const checked = workflowV2DefinitionCheck(definition);
        const catalogue = await this.resolveCatalogue(id, checked);
        const subject: ExecutionSubject =
          checked.subjectMode === "idea"
            ? {
                kind: "idea",
                sourceId: "preview",
                revision: "preview",
                markdown: "Preflight only",
                ideaId: "preview",
              }
            : {
                kind: "note",
                sourceId: "preview",
                revision: "preview",
                markdown: "Preflight only",
              };
        compileWorkflowV2(checked, subject, catalogue);
        return this.storage.save(id, checked, expected);
      },
      preflight: (id, path, simulation) => this.preflight(id, path, simulation),
      start: (id, path, simulation, destination, expectedIdentity, automationEvent) =>
        this.start(
          id,
          path,
          simulation,
          destination,
          undefined,
          expectedIdentity,
          automationEvent,
        ),
    };
  }
  messageRecipient(
    projectId: string,
    teamId: string,
  ): Promise<MessageRecipient | null> {
    return workflowMessageRecipient(
      projectId,
      teamId,
      (id) => this.storage.load(id),
      (id, definition) => this.resolveCatalogue(id, definition),
    );
  }
  private project(projectId: string): void {
    if (
      !this.studio
        .state()
        .projects?.some((item) => item.id === projectId && !item.unavailable)
    )
      throw new Error("The selected workflow project is unavailable.");
  }
  private async resolveCatalogue(
    projectId: string,
    definition: WorkflowV2Definition,
  ): Promise<WorkflowV2Catalogue> {
    this.project(projectId);
    const snapshot = await this.catalogue.list();
    const definitions = snapshot.valid.map((item) => item.definition);
    const team = definitions.find((item) => item.id === definition.teamId);
    if (!team || team.schema !== "team/v1")
      throw new Error("Select an available team for this workflow.");
    return {
      projectId,
      team,
      agents: definitions.filter(
        (item): item is AgentDefinition => item.schema === "agent/v1",
      ),
      councils: definitions.filter(
        (item): item is CouncilDefinition => item.schema === "council/v1",
      ),
      ...(definition.steps.some(step => (step.kind === 'agent' || step.kind === 'council') && step.outputTemplateId) ? {
        outputTemplates: await captureWorkflowOutputTemplates(projectId, definition.steps.filter(step => step.kind === 'agent' || step.kind === 'council'), this.outputTemplates),
      } : {}),
    };
  }
  private sourcePath(path: string): string {
    const normalized = normalizeVaultFolder(path);
    if (
      [
        this.studio.integration().publicFolder,
        "CoForge/Public",
        this.plugin.app.vault.configDir,
        ".git",
        WORKFLOW_OUTPUT_TEMPLATES_FOLDER,
        ...(this.contextOptions?.definitionFolders() ??
          Object.values(DEFAULT_COUNCIL_FOLDERS)),
      ].some((folder) => vaultFoldersOverlap(normalized, folder))
    )
      throw new Error(
        "Select a private source outside configuration, definitions and public exports.",
      );
    return normalized;
  }
  private async subject(
    definition: WorkflowV2Definition,
    projectId: string,
    path: string,
  ): Promise<ExecutionSubject> {
    const note = await this.sources.read(path);
    if (!note.body.trim() || note.hasHumanContent === false || note.draft)
      throw new Error(
        "Submit a nonempty note and clear Draft before dispatch.",
      );
    const source = {
      sourceId: note.sourceId ?? "unassigned",
      revision: note.sourceRevision,
      markdown: note.body,
    };
    if (definition.subjectMode === "note") return { kind: "note", ...source };
    const file = this.plugin.app.vault.getFileByPath(path);
    const ideaNote = file
      ? readIdeaNote(await this.plugin.app.vault.read(file))
      : null;
    const idea = this.studio
      .state()
      .ideas.find(
        (item) => item.id === ideaNote?.id && item.projectId === projectId,
      );
    if (!idea)
      throw new Error(
        "Idea mode requires an existing Idea note belonging to this project. A generic note cannot manufacture viewer identity or approval.",
      );
    return { kind: "idea", ...source, ideaId: idea.id };
  }
  private context(
    plan: WorkflowV2Preview["plan"],
    project: InvocationProjectContext,
  ): Promise<string> {
    return readWorkflowNoteContext(
      this.plugin.app.vault,
      plan,
      (path) => this.sourcePath(path),
      this.contextOptions,
      project,
    );
  }
  async preflight(
    projectId: string,
    path: string,
    simulation = false,
  ): Promise<WorkflowV2Preview> {
    this.project(projectId);
    const saved = await this.storage.load(projectId);
    if (!saved.definition)
      throw new Error(
        "Save an explicit v2 workflow before configuring its intake. The v1 workflow remains available in Workflow settings.",
      );
    const normalized = this.sourcePath(path);
    const subject = await this.subject(saved.definition, projectId, normalized);
    const plan = compileWorkflowV2(
      saved.definition,
      subject,
      await this.resolveCatalogue(projectId, saved.definition),
    );
    for (const invocation of plan.invocations) {
      if (!simulation && invocation.provider === "herdr")
        throw new Error(
          "This provider cannot enforce the required isolated typed invocation. Select native Claude, Codex or Simulation.",
        );
      if (
        !simulation &&
        (invocation.provider === 'claude' && !this.studio.state().runtime.cliAvailable || invocation.provider === 'codex' && !this.studio.state().runtime.codexAvailable)
      )
        throw new Error(
          "The selected native provider is unavailable. Check the runtime configuration.",
        );
    }
    const note = await this.sources.read(normalized);
    const project = captureInvocationProject(this.studio.state(), projectId);
    for (const item of plan.invocations)
      projectInvocationInstructions(project.agentPrompt, item.instructions);
    return {
      plan,
      projectPrompt: project.agentPrompt,
      source: {
        sourceId: note.sourceId ?? "unassigned",
        generation: note.generation,
        revision: note.sourceRevision,
        markdown: note.body,
      },
      context: await this.context(plan, project),
      invocations: plan.invocations.length,
      warnings: simulation
        ? ["Simulation uses fake results at the chosen test destination."]
        : [],
    };
  }
  async start(
    projectId: string,
    path: string,
    simulation = false,
    destination?: string,
    submissionKey?: string,
    expectedIdentity?: string,
    automationEvent?: AutomationContext,
  ): Promise<ExecutionRun> {
    await this.assertExecutor();
    const preview = await this.preflight(projectId, path, simulation);
    assertReviewedWorkflowIdentity(preview, expectedIdentity);
    if (
      !simulation &&
      preview.plan.invocations.some((item) => item.provider === "demo")
    )
      throw new Error(
        "Simulation agents require an explicit test destination. Run a workflow simulation instead.",
      );
    let sourcePath = this.sourcePath(path);
    if (simulation) {
      const target = normalizeVaultFolder(destination ?? "");
      if (
        !target.toLowerCase().startsWith("coforge/tests/") ||
        !target.endsWith(".md")
      )
        throw new Error(
          "Choose a new Markdown test destination inside CoForge/Tests.",
        );
      if (this.plugin.app.vault.getAbstractFileByPath(target))
        throw new Error(
          "The simulation destination already exists. Choose a new note.",
        );
      await this.protect(["CoForge/Tests"]);
      await this.ensureFolders(target);
      await this.plugin.app.vault.create(
        target,
        `# Workflow simulation\n\n${preview.source.markdown}`,
      );
      sourcePath = target;
    }
    const folder = sourcePath.split("/").slice(0, -1).join("/");
    if (!folder)
      throw new Error(
        "Move the source into a private folder before submitting.",
      );
    await this.protect([folder]);
    const identified = await this.sources.identify(
      await this.sources.read(sourcePath),
    );
    if (!identified.body.trim() || identified.draft)
      throw new Error(
        "The source is empty or marked Draft. Submit it explicitly before dispatch.",
      );
    if (!simulation && identified.sourceRevision !== preview.source.revision)
      throw new Error(
        "The source changed during preflight. Review the current note before submitting.",
      );
    preview.source = {
      sourceId: identified.sourceId,
      generation: identified.generation,
      revision: identified.sourceRevision,
      markdown: identified.body,
    };
    return this.kernel.admit(
      attachAutomationEvent(workflowV2Admission(
        preview,
        crypto.randomUUID(),
        submissionKey ??
          intakeSubmissionKey(
            `workflow-v2-${projectId}`,
            identified.sourceId,
            identified.generation,
          ),
        simulation,
      ), automationEvent),
    );
  }
  async startAgain(
    projectId: string,
    path: string,
    simulation: boolean,
  ): Promise<ExecutionRun> {
    if (!simulation) return this.start(projectId, path);
    await this.assertExecutor();
    const normalized = this.sourcePath(path);
    if (!normalized.toLowerCase().startsWith("coforge/tests/"))
      throw new Error(
        "A simulated rerun requires its existing explicit test destination.",
      );
    const preview = await this.preflight(projectId, normalized, true);
    const identified = await this.sources.identify(
      await this.sources.read(normalized),
    );
    if (
      identified.draft ||
      !identified.body.trim() ||
      identified.sourceRevision !== preview.source.revision
    )
      throw new Error(
        "The simulation source changed. Review it before running again.",
      );
    preview.source = {
      sourceId: identified.sourceId,
      generation: identified.generation,
      revision: identified.sourceRevision,
      markdown: identified.body,
    };
    return this.kernel.admit(
      workflowV2Admission(
        preview,
        crypto.randomUUID(),
        intakeSubmissionKey(
          `workflow-v2-${projectId}`,
          identified.sourceId,
          identified.generation,
        ),
        true,
      ),
    );
  }
  private async ensureFolders(path: string): Promise<void> {
    const folders = path.split("/").slice(0, -1);
    let current = "";
    for (const folder of folders) {
      current = current ? `${current}/${folder}` : folder;
      if (!this.plugin.app.vault.getAbstractFileByPath(current))
        await this.plugin.app.vault.createFolder(current);
    }
  }
}
