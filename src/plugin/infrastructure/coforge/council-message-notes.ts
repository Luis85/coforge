import { TFile, type Vault } from "obsidian";
import { stringify } from "yaml";
import type { TeamMessage } from "../../features/coforge/domain/team-messages";
import type { ExecutionRun } from "../../features/coforge/domain/execution-run";
import { writeCouncilSubmission } from "./council-source-format";
import { readCouncilSource } from "./council-source-notes";
import { markdownForNote } from "../../features/coforge/domain/markdown-note";

/** Runtime provenance in this note is a readable projection; only the journal is trusted. */
export function renderCouncilMessage(message: TeamMessage): string {
  const properties = stringify(
    {
      coforge_message: {
        schema: "message/v1",
        id: message.id,
        purpose: message.purpose,
        sender: message.senderId,
        recipient: message.recipientId,
        team: message.teamId,
        project: message.projectId,
        root: message.rootId,
        thread: message.threadId,
        run: message.runId,
        attempt: message.attemptId,
        created: message.createdAt,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      },
    },
    { lineWidth: 0 },
  );
  return writeCouncilSubmission(
    `---\n${properties}---\n# ${message.purpose === "request" ? "Request" : message.purpose === "reply" ? "Reply" : "Team information"}\n\n${markdownForNote(message.body)}\n`,
    {
      schema: "submission/v1",
      id: message.id,
      generation: 0,
      draft: false,
      ready: true,
    },
  );
}
export class CouncilMessageNotes {
  constructor(
    private readonly vault: Pick<
      Vault,
      "getAbstractFileByPath" | "read" | "create" | "createFolder"
    >,
    private readonly protect: (folders: string[]) => Promise<void>,
    private readonly runs: () => readonly ExecutionRun[] = () => [],
  ) {}
  async deliver(message: TeamMessage): Promise<string> {
    const folder = `CoForge/Messages/Teams/${message.teamId}`;
    const path = `${folder}/${message.id}.md`;
    const markdown = renderCouncilMessage(message);
    await this.protect(["CoForge/Messages"]);
    let current = "";
    for (const segment of folder.split("/")) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.vault.getAbstractFileByPath(current))
        await this.vault.createFolder(current);
    }
    const existing = this.vault.getAbstractFileByPath(path);
    if (existing) {
      if (
        !(existing instanceof TFile) ||
        readCouncilSource(
          await this.vault.read(existing),
          path,
          this.runs(),
        ).body.trimEnd() !==
          readCouncilSource(markdown, path, this.runs()).body.trimEnd()
      )
        throw new Error(
          "Message publication conflict. Preserve the edited note and inspect the saved outgoing message before repairing delivery.",
        );
      return path;
    }
    await this.vault.create(path, markdown);
    return path;
  }
}
