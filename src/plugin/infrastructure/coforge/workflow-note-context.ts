import type { Vault, TFile } from "obsidian";
import type { WorkflowV2Preview } from "../../features/coforge/application/workflow-v2-ports";
import type { TeamContextSelection } from "../../features/coforge/domain/team-messages";
import type { InvocationProjectContext } from "../../features/coforge/application/invocation-project-context";
export interface WorkflowContextOptions {
  projectFile?(id: string): TFile | null;
  definitionFolders(): readonly string[];
  messages(
    teamId: string,
    projectId: string,
    recentLimit: number,
    maxCharacters: number,
  ): TeamContextSelection;
}
/** Explicit notes and bounded team messages are frozen once for an admitted workflow. */
export async function readWorkflowNoteContext(
  vault: Pick<Vault, "getFileByPath" | "read">,
  plan: WorkflowV2Preview["plan"],
  sourcePath: (path: string) => string,
  options?: WorkflowContextOptions,
  project?: InvocationProjectContext,
): Promise<string> {
  const ids = new Set(plan.invocations.map((item) => item.agentId));
  const paths = [
    ...new Set([
      ...plan.catalogue.team.pinnedContext,
      ...plan.catalogue.agents
        .filter((item) => ids.has(item.id))
        .flatMap((item) => item.contextSources),
    ]),
  ];
  const pieces: { path: string; markdown: string }[] = [];
  for (const path of paths) {
    const normalized = sourcePath(path);
    const file = vault.getFileByPath(normalized);
    if (!file || file.extension !== "md")
      throw new Error("An explicitly selected context note is missing.");
    pieces.push({
      path: normalized,
      markdown: await vault.read(file),
    });
  }
  const context = JSON.stringify({
    project,
    selectedNotes: pieces,
    messages: options?.messages(
      plan.catalogue.team.id,
      plan.catalogue.team.projectId,
      plan.catalogue.team.recentMessages,
      160000,
    ),
  });
  if (context.length + plan.subject.markdown.length > 160000)
    throw new Error(
      "Complete source/context exceeds its allowance. Nothing was truncated.",
    );
  return context;
}
