import { ExecutionBlockError } from "../../features/coforge/domain/execution-block";
import {
  captureInvocationProject,
  captureInvocationLimits,
  projectInvocationInstructions,
  type InvocationProjectContext,
} from "../../features/coforge/application/invocation-project-context";
import type { Plugin } from "obsidian";
import type { StudioService } from "../../features/coforge/application/studio";
import type { CouncilCatalogueActions } from "../../features/coforge/application/council-catalogue";
import {
  decodeCouncilPlan,
  resolveCouncilPlan,
  type CouncilPreflight,
  type CouncilTarget,
} from "../../features/coforge/application/council-execution";
import {
  isWorkflowV2Run,
  decodeWorkflowV2Plan,
} from "../../features/coforge/application/workflow-v2-execution";
import {
  executionSourceRevisionAccepted,
  type ExecutionInvocation,
  type ExecutionRun,
} from "../../features/coforge/domain/execution-run";
import {
  normalizeVaultFolder,
  vaultFoldersOverlap,
} from "../../features/coforge/domain/vault-folder-policy";
import { DEFAULT_COUNCIL_FOLDERS } from "./vault-council-definitions";
import type { CouncilMessagingModule } from "./council-messaging-module";
import type { CouncilSourceNotes } from "./council-source-notes";

/** Source snapshots and live host policy are checked separately from editable definitions. */
export class CouncilRunContext {
  constructor(
    private readonly plugin: Plugin,
    private readonly studio: StudioService,
    private readonly sources: CouncilSourceNotes,
    private readonly catalogue: CouncilCatalogueActions,
    private readonly messaging: CouncilMessagingModule,
    private readonly assertReady: () => void,
    private readonly assertExecutor: () => void | Promise<void>,
    private readonly projectPaused: (id: string) => boolean,
    private readonly definitionFolders: () => readonly string[] = () =>
      Object.values(DEFAULT_COUNCIL_FOLDERS),
  ) {}
  sourcePath(path: string): string {
    const normalized = normalizeVaultFolder(path);
    if (
      [
        this.studio.integration().publicFolder,
        "CoForge/Public",
        this.plugin.app.vault.configDir,
        ".git",
        ...this.definitionFolders(),
      ].some((folder) => vaultFoldersOverlap(normalized, folder))
    )
      throw new Error(
        "Select a private source note outside definitions, configuration and public exports.",
      );
    return normalized;
  }
  projectReady(id: string): boolean {
    return Boolean(
      this.studio
        .state()
        .projects?.some((project) => project.id === id && !project.unavailable),
    );
  }
  private async context(
    plan: CouncilPreflight["plan"],
    project: InvocationProjectContext,
  ): Promise<string> {
    const paths = [
      ...new Set([
        ...plan.team.pinnedContext,
        ...plan.invocations.flatMap((item) => item.agent.contextSources),
      ]),
    ];
    const pieces: { path: string; markdown: string }[] = [];
    for (const path of paths) {
      const normalized = normalizeVaultFolder(path);
      if (
        [
          this.studio.integration().publicFolder,
          this.plugin.app.vault.configDir,
          ".git",
        ].some((folder) => vaultFoldersOverlap(normalized, folder))
      )
        throw new Error(
          "Context sources must be explicit private Markdown notes outside configuration and exports.",
        );
      const file = this.plugin.app.vault.getFileByPath(normalized);
      if (!file || file.extension !== "md")
        throw new Error(
          "A selected context note is missing. Repair the explicit context selection before dispatch.",
        );
      pieces.push({
        path: normalized,
        markdown: await this.plugin.app.vault.read(file),
      });
    }
    const messages = this.messaging.context(
      plan.team.id,
      plan.team.projectId,
      plan.team.recentMessages,
      plan.definition.limits.maxContextCharacters,
    );
    return JSON.stringify({ project, selectedNotes: pieces, messages });
  }
  async preflight(
    target: CouncilTarget,
    path: string,
    simulation = false,
  ): Promise<CouncilPreflight> {
    this.assertReady();
    const plan = resolveCouncilPlan(await this.catalogue.list(), target);
    this.sourcePath(path);
    if (!this.projectReady(plan.definition.projectId))
      throw new Error(
        "The council project is unavailable. Restore it before running.",
      );
    const note = await this.sources.read(path);
    if (note.draft) throw new ExecutionBlockError("source-draft");
    if (!note.body.trim() || note.hasHumanContent === false || note.draft)
      throw new Error(
        "Submit a nonempty note and clear Draft before dispatch.",
      );
    for (const item of plan.invocations) {
      if (!simulation && item.agent.provider === "herdr")
        throw new Error(
          "Herdr isolated typed invocation is unavailable. Select native Claude or Simulation.",
        );
      if (
        !simulation &&
        item.agent.provider === "claude" &&
        !this.studio.state().runtime.cliAvailable
      )
        throw new Error(
          "The native Claude runtime is unavailable. Check runtime settings first.",
        );
    }
    const projectState = this.studio.state();
    const project = captureInvocationProject(
      projectState,
      plan.definition.projectId,
    );
    const executionLimits = captureInvocationLimits(
      projectState,
      plan.definition.projectId,
    );
    for (const item of plan.invocations)
      projectInvocationInstructions(
        project.agentPrompt,
        `${item.agent.role}\n\n${item.agent.instructions}\n\n${item.instructions}`,
      );
    const context = await this.context(plan, project);
    if (
      context.length + note.body.length >
      plan.definition.limits.maxContextCharacters
    )
      throw new Error(
        "Source and selected context exceed the complete input allowance. Nothing was truncated.",
      );
    return {
      plan,
      projectPrompt: project.agentPrompt,
      executionLimits,
      context,
      source: {
        sourceId: note.sourceId ?? "unassigned",
        generation: note.generation,
        revision: note.sourceRevision,
        markdown: note.body,
      },
      invocations: plan.invocations.length,
      warnings: simulation
        ? ["Simulation output is fake and does not qualify a live provider."]
        : [],
    };
  }
  async assertRun(run: ExecutionRun): Promise<void> {
    await this.assertExecutor();
    if (this.projectPaused(run.projectId))
      throw new ExecutionBlockError("project-paused");
    if (!this.projectReady(run.projectId))
      throw new ExecutionBlockError("member-revoked");
    this.messaging.assertRunAllowed(run);
    const path = this.sourcePath(
      this.sources.resolve(
        run.projectionTarget?.sourceId ?? run.subject.sourceId,
      ),
    );
    const note = await this.sources.read(path);
    if (note.draft) throw new ExecutionBlockError("source-draft");
    if (!executionSourceRevisionAccepted(run, note.sourceRevision))
      throw new ExecutionBlockError("source-changed");
  }
  async eligible(
    run: ExecutionRun,
    invocation: ExecutionInvocation,
  ): Promise<void> {
    await this.assertRun(run);
    if (invocation.provider === "herdr")
      throw new ExecutionBlockError("provider-unavailable");
    const catalogue = await this.catalogue.list();
    const definitions = catalogue.valid.map((item) => item.definition);
    const currentTeam = definitions.find((item) => item.id === run.teamId);
    if (
      !currentTeam ||
      currentTeam.schema !== "team/v1" ||
      !currentTeam.enabled ||
      currentTeam.projectId !== run.projectId ||
      !currentTeam.members.includes(invocation.agentId)
    )
      throw new ExecutionBlockError("member-revoked");
    if (isWorkflowV2Run(run)) {
      const plan = decodeWorkflowV2Plan(run);
      const owner = plan.councils.find((item) =>
        item.plan.invocations.some(
          (member) => `${item.prefix}${member.id}` === invocation.id,
        ),
      );
      const ids = [
        plan.catalogue.team.id,
        invocation.agentId,
        ...(owner ? [owner.plan.definition.id] : []),
      ];
      if (
        ids.some(
          (id) => !definitions.some((item) => item.id === id && item.enabled),
        )
      )
        throw new ExecutionBlockError("member-revoked");
      if (owner) {
        const current = definitions.find(
          (item) => item.id === owner.plan.definition.id,
        );
        if (
          !current ||
          current.schema !== "council/v1" ||
          current.projectId !== run.projectId ||
          current.teamId !== run.teamId ||
          !current.members.includes(invocation.agentId)
        )
          throw new ExecutionBlockError("member-revoked");
      }
      if (
        invocation.provider === "claude" &&
        !this.studio.state().runtime.cliAvailable
      )
        throw new ExecutionBlockError("provider-unavailable");
      return;
    }
    const plan = decodeCouncilPlan(run);
    const ids = [
      plan.team.id,
      invocation.agentId,
      ...(plan.targetKind === "agent" ? [] : [plan.definition.id]),
    ];
    if (
      ids.some(
        (id) => !definitions.some((item) => item.id === id && item.enabled),
      )
    )
      throw new ExecutionBlockError("member-revoked");
    if (plan.targetKind !== "agent") {
      const current = definitions.find(
        (item) => item.id === plan.definition.id,
      );
      if (
        !current ||
        current.schema !== "council/v1" ||
        current.projectId !== run.projectId ||
        current.teamId !== run.teamId ||
        !current.members.includes(invocation.agentId)
      )
        throw new ExecutionBlockError("member-revoked");
    }
    if (
      invocation.provider === "claude" &&
      !this.studio.state().runtime.cliAvailable
    )
      throw new ExecutionBlockError("provider-unavailable");
  }
}
