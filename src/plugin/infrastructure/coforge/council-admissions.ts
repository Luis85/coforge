import type { Plugin } from "obsidian";
import type { StudioService } from "../../features/coforge/application/studio";
import type { CouncilCatalogueActions } from "../../features/coforge/application/council-catalogue";
import {
  councilAdmission,
  decodeCouncilPlan,
  resolveCouncilPlan,
  type CouncilTarget,
  type CouncilPreflight,
} from "../../features/coforge/application/council-execution";
import type { ExecutionKernel } from "../../features/coforge/application/execution-kernel";
import type { IntakeAdmission } from "../../features/coforge/application/intake-service";
import { isWorkflowV2Run } from "../../features/coforge/application/workflow-v2-execution";
import type { ExecutionRun } from "../../features/coforge/domain/execution-run";
import {
  intakeSubmissionKey,
  type IntakeBinding,
} from "../../features/coforge/domain/intake-bindings";
import { normalizeVaultFolder } from "../../features/coforge/domain/vault-folder-policy";
import { contextEventId } from "../../features/coforge/domain/integrity";
import { ideaProjectId } from "../../features/coforge/domain/projects";
import type { CouncilSourceNotes } from "./council-source-notes";
import type { CouncilRunContext } from "./council-run-context";
import type { CouncilWorkflowModule } from "./council-workflow-module";
import type { CouncilMessagingModule } from "./council-messaging-module";
import { workflowPlanMapping } from "../../features/coforge/application/workflow-plan-mapping";
import { assertReviewedCouncilIdentity } from "../../features/coforge/application/reviewed-preflight";
import { attachAutomationEvent } from '../../features/coforge/application/automation-admission';
import type { AutomationContext } from '../../features/coforge/domain/automation-context';

/** Every entry point captures the source once and enters the same durable journal. */
export class CouncilAdmissions {
  constructor(
    private readonly plugin: Plugin,
    private readonly studio: StudioService,
    private readonly kernel: ExecutionKernel,
    private readonly sources: CouncilSourceNotes,
    private readonly catalogue: CouncilCatalogueActions,
    private readonly context: CouncilRunContext,
    private readonly workflows: CouncilWorkflowModule,
    private readonly messaging: CouncilMessagingModule,
    private readonly protect: (paths: string[]) => Promise<void>,
    private readonly assertExecutor: () => Promise<void>,
  ) {}
  private runs(): ExecutionRun[] {
    return this.kernel.snapshot().runs;
  }
  async handoffPlan(
    runId: string,
    artifactId: string,
    ideaId: string,
    expectedProposalRevision: string,
  ): Promise<void> {
    await this.assertExecutor();
    const run = this.runs().find((item) => item.id === runId);
    const idea = this.studio.state().ideas.find((item) => item.id === ideaId);
    if (!run) throw new Error("The source run is unavailable.");
    const mapping = workflowPlanMapping(run, artifactId);
    if (!idea || ideaProjectId(idea) !== run.projectId)
      throw new Error(
        "Select an existing Idea from the same project. Generic note work does not create viewer identity or implementation authority.",
      );
    if (run.subject.kind === "idea" && run.subject.ideaId !== ideaId)
      throw new Error(
        "A plan captured for an Idea can only continue that same Idea.",
      );
    if (this.kernel.isPaused)
      throw new Error("Resume execution before explicitly handing off a plan.");
    await this.studio.engine.startWorkflowFromPlan(ideaId, {
      plan: mapping.plan,
      sourceRunId: run.id,
      sourceArtifactId: mapping.artifactId,
      expectedProposalRevision,
    });
  }
  async validateTarget(binding: IntakeBinding): Promise<void> {
    if (binding.target.kind === "workflow") {
      const definition = (await this.workflows.actions.load(binding.projectId))
        .definition;
      if (!definition)
        throw new Error(
          "Save this project’s v2 workflow before activating its inbox.",
        );
      if (definition.teamId !== binding.teamId)
        throw new Error("The inbox team does not match the project workflow.");
      return;
    }
    if (binding.target.kind === "team") {
      const team = (await this.catalogue.list()).valid.find(
        (item) => item.definition.id === binding.target.id,
      )?.definition;
      if (
        !team ||
        team.schema !== "team/v1" ||
        !team.enabled ||
        team.id !== binding.teamId ||
        team.projectId !== binding.projectId
      )
        throw new Error(
          "Select a matching enabled project team for this inbox.",
        );
      return;
    }
    const plan = resolveCouncilPlan(await this.catalogue.list(), {
      kind: binding.target.kind,
      id: binding.target.id,
      teamId: binding.teamId,
    });
    if (plan.definition.projectId !== binding.projectId)
      throw new Error(
        "The inbox project does not match its selected team and target.",
      );
  }
  async submit(
    target: CouncilTarget,
    path: string,
    simulation = false,
    key?: string,
    expectedIdentity?: string,
    automationEvent?: AutomationContext,
    executionCeiling?: import('../../features/coforge/application/invocation-project-context').InvocationExecutionLimits,
  ): Promise<ExecutionRun> {
    await this.assertExecutor();
    const preview = await this.context.preflight(target, path, simulation);
    assertReviewedCouncilIdentity(preview, expectedIdentity);
    if (executionCeiling && preview.executionLimits) preview.executionLimits = {
      timeoutSeconds: Math.min(preview.executionLimits.timeoutSeconds, executionCeiling.timeoutSeconds),
      maxTurns: Math.min(preview.executionLimits.maxTurns, executionCeiling.maxTurns),
      maxBudgetUsd: Math.min(preview.executionLimits.maxBudgetUsd, executionCeiling.maxBudgetUsd),
    };
    if (
      !simulation &&
      preview.plan.invocations.some((item) => item.agent.provider === "demo")
    )
      throw new Error(
        "Simulation agents require an explicit test destination. Use Test with note before dispatching.",
      );
    return this.capture(
      preview,
      target.id,
      path,
      simulation,
      key,
      preview.source.revision,
      automationEvent,
    );
  }
  private async capture(
    preview: CouncilPreflight,
    targetId: string,
    path: string,
    simulation: boolean,
    key?: string,
    expectedRevision?: string,
    automationEvent?: AutomationContext,
  ): Promise<ExecutionRun> {
    if (!preview.executionLimits)
      throw new Error(
        "The reviewed native invocation limits are missing. Run preflight again.",
      );
    const parent = normalizeVaultFolder(path).split("/").slice(0, -1).join("/");
    if (!parent)
      throw new Error(
        "Move the source into a private folder before submitting; the vault root cannot be protected as an intake.",
      );
    await this.protect([parent]);
    const identified = await this.sources.identify(
      await this.sources.read(path),
    );
    preview.source = {
      sourceId: identified.sourceId,
      generation: identified.generation,
      revision: identified.sourceRevision,
      markdown: identified.body,
    };
    if (
      identified.draft ||
      !identified.body.trim() ||
      identified.hasHumanContent === false ||
      (expectedRevision !== undefined &&
        identified.sourceRevision !== expectedRevision)
    )
      throw new Error(
        "The source changed during preflight. Review the current note before submitting.",
      );
    return this.kernel.admit(
      attachAutomationEvent(councilAdmission(
        preview,
        crypto.randomUUID(),
        key ??
          intakeSubmissionKey(
            `manual-${targetId}`,
            identified.sourceId,
            identified.generation,
          ),
        {
          ...preview.executionLimits!,
          simulation,
        },
      ), automationEvent, preview.plan.definition.limits.maxContextCharacters),
    );
  }
  async admit(
    input: IntakeAdmission,
  ): Promise<"admitted" | "duplicate" | "deferred"> {
    await this.assertExecutor();
    const duplicate = this.kernel
      .snapshot()
      .submissions.some((item) => item.key === input.key);
    if (duplicate) return "duplicate";
    const current = await this.sources.read(input.path);
    if (
      current.sourceId !== input.sourceId ||
      current.sourceRevision !== input.sourceRevision ||
      current.generation !== input.generation ||
      current.draft
    )
      return "deferred";
    if (input.target.kind === "team") {
      await this.messaging.postInformation(
        input.teamId,
        input.content,
        contextEventId(input.key),
      );
      return "admitted";
    }
    if (
      this.runs().filter(
        (run) => !["completed", "cancelled"].includes(run.state),
      ).length >= 50
    )
      return "deferred";
    if (input.target.kind === "workflow") {
      await this.workflows.start(
        input.projectId,
        input.path,
        false,
        undefined,
        input.key,
      );
      return "admitted";
    }
    if (input.target.kind !== "agent" && input.target.kind !== "council")
      throw new Error("The intake target mapping is unavailable.");
    await this.submit(
      { kind: input.target.kind, id: input.target.id, teamId: input.teamId },
      input.path,
      false,
      input.key,
    );
    return "admitted";
  }

  async simulate(
    target: CouncilTarget,
    path: string,
    destination: string,
    expectedIdentity?: string,
  ): Promise<ExecutionRun> {
    await this.assertExecutor();
    const preview = await this.context.preflight(target, path, true);
    assertReviewedCouncilIdentity(preview, expectedIdentity);
    const normalized = normalizeVaultFolder(destination);
    if (
      !normalized.toLowerCase().startsWith("coforge/tests/") ||
      !normalized.endsWith(".md")
    )
      throw new Error(
        "Choose a new Markdown test destination inside CoForge/Tests.",
      );
    await this.protect(["CoForge/Tests"]);
    if (this.plugin.app.vault.getAbstractFileByPath(normalized))
      throw new Error(
        "The test destination exists. Choose a new note to preserve its content.",
      );
    let folder = "";
    for (const segment of normalized.split("/").slice(0, -1)) {
      folder = folder ? folder + "/" + segment : segment;
      if (!this.plugin.app.vault.getAbstractFileByPath(folder))
        await this.plugin.app.vault.createFolder(folder);
    }
    await this.plugin.app.vault.create(
      normalized,
      "# Simulation\n\n" + preview.source.markdown,
    );
    return this.capture(preview, target.id, normalized, true);
  }
  async runAgain(sourceId: string): Promise<void> {
    await this.assertExecutor();
    const previous = [...this.runs()]
      .reverse()
      .find((run) => run.subject.sourceId === sourceId);
    if (!previous)
      throw new Error(
        "The original run is unavailable. Submit the source explicitly.",
      );
    if (
      this.runs().some(
        (run) =>
          run.subject.sourceId === sourceId &&
          !["completed", "cancelled"].includes(run.state),
      )
    )
      throw new Error(
        "Finish or cancel the existing source run before creating another generation.",
      );
    const note = await this.sources.runAgain(sourceId);
    if (isWorkflowV2Run(previous)) {
      await this.workflows.startAgain(
        previous.projectId,
        note.path,
        previous.limits?.simulation ?? false,
      );
      return;
    }
    if (
      previous.submissionKey.startsWith('["manual-') ||
      previous.submissionKey.startsWith("message:")
    ) {
      const plan = decodeCouncilPlan(previous);
      await this.submit(
        {
          kind: plan.targetKind === "agent" ? "agent" : "council",
          id:
            plan.targetKind === "agent"
              ? plan.invocations[0]!.agent.id
              : plan.definition.id,
          teamId: plan.team.id,
        },
        note.path,
        previous.limits?.simulation ?? false,
      );
    }
  }
}
