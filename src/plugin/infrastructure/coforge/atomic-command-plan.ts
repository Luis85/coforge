import type { Player } from "../../features/coforge/domain/population";
import { defaultEconomyDefinition, type EconomyState } from "../../features/coforge/domain/command-economy";
import { randomUUID } from "node:crypto";
import {
  normalizePath,
  stringifyYaml,
  type Plugin,
  type TFile,
} from "obsidian";
import type {
  InternalState,
  NoteIdea,
  SaveOptions,
} from "../../features/coforge/application/ports";
import type { Idea } from "../../features/coforge/domain/types";
import { ideaFingerprint } from "../../features/coforge/domain/integrity";
import {
  ideaBody,
  ideaFileName,
  ideaProperties,
} from "../../features/coforge/domain/idea-note";
import { appendContextBody } from "../../features/coforge/domain/idea-context";
import { writeManagedIdeaProperties } from "./request-values-note";
import { splitNote } from "./markdown";
import type {
  AtomicCommandJournal,
  AtomicCommandNote,
} from "./atomic-command-format";

const noteIdentity = (idea: Idea, author: string) =>
  JSON.stringify(ideaProperties(idea, author));
/** Pure planned bytes come from current canonical notes; no fee or note effect precedes durable intent. */
export async function planAtomicCommand(host: {
  plugin: Plugin;
  next: InternalState;
  previous: InternalState;
  dataPath: string;
  afterData: string;
  beforeData: string;
  folder: string;
  file(id: string): TFile | null;
  read(content: string): NoteIdea | null;
}): Promise<AtomicCommandJournal> {
  const { plugin, next, previous, folder } = host;
  if (
    next.integration.ideasFolder !== folder ||
    JSON.stringify(next.integration) !== JSON.stringify(previous.integration) ||
    JSON.stringify(next.projects) !== JSON.stringify(previous.projects) ||
    previous.ideas.some(
      (idea) => !next.ideas.some((item) => item.id === idea.id),
    )
  )
    throw new Error(
      "A command cannot change project configuration, move folders or remove request notes.",
    );
  const adapter = plugin.app.vault.adapter;
  if (
    !(await adapter.exists(host.dataPath)) ||
    (await adapter.read(host.dataPath)) !== host.beforeData
  )
    throw new Error(
      "The command ledger changed outside this session. Reload CoForge before retrying; no note or fee was written.",
    );
  const authors = new Map(
    next.contributors.map((item) => [item.id, item.name]),
  );
  const oldAuthors = new Map(
    previous.contributors.map((item) => [item.id, item.name]),
  );
  const recoveryId = randomUUID();
  const effects: AtomicCommandNote[] = [];
  const reserved = new Set<string>();
  const targets = next.ideas.filter((idea) => {
    const before = previous.ideas.find((item) => item.id === idea.id);
    return (
      !before ||
      noteIdentity(
        before,
        oldAuthors.get(before.authorId) ?? before.authorId,
      ) !== noteIdentity(idea, authors.get(idea.authorId) ?? idea.authorId)
    );
  });
  const identities = new Map<string, number>();
  if (targets.length)
    for (const file of plugin.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(folder + "/"))) {
      let id: string | undefined;
      try {
        id = host.read(await plugin.app.vault.read(file))?.id;
      } catch {
        continue;
      }
      if (id) identities.set(id, (identities.get(id) ?? 0) + 1);
    }
  for (const idea of targets) {
    const author = authors.get(idea.authorId) ?? idea.authorId;
    const before = previous.ideas.find((item) => item.id === idea.id);
    const file = host.file(idea.id);
    if (before) {
      if (!file || identities.get(idea.id) !== 1)
        throw new Error(
          "A command request note is missing or duplicated. Restore unique canonical notes before retrying.",
        );
      const current = await plugin.app.vault.read(file);
      const canonical = host.read(current);
      if (
        !canonical ||
        canonical.id !== idea.id ||
        ideaFingerprint(canonical) !== ideaFingerprint(before)
      )
        throw new Error(
          "The canonical request changed before this command. Reconcile it before retrying; no fee was committed.",
        );
      const managed = writeManagedIdeaProperties(current, idea, author);
      const { body } = splitNote(managed);
      const appended = appendContextBody(body, idea.contexts ?? []);
      const after = managed.slice(0, managed.length - body.length) + appended;
      effects.push({ id: idea.id, path: file.path, before: current, after });
    } else {
      if (file || identities.has(idea.id))
        throw new Error(
          "The new request identity already exists. Reload before retrying the command.",
        );
      const base = normalizePath(`${folder}/${ideaFileName(idea)}`);
      let path = base;
      for (
        let index = 2;
        plugin.app.vault.getAbstractFileByPath(path) ||
        (await adapter.exists(path)) ||
        reserved.has(path.toLowerCase());
        index++
      )
        path = base.replace(/\.md$/u, ` ${index}.md`);
      effects.push({
        id: idea.id,
        path,
        before: null,
        rollbackPath: `CoForge/Recovery/Commands/${recoveryId}/${effects.length}.coforge-archive`,
        after: `---\n${stringifyYaml(ideaProperties(idea, author))}---\n${appendContextBody(ideaBody(idea), idea.contexts ?? [])}`,
      });
      reserved.add(path.toLowerCase());
    }
  }
  return {
    format: "coforge-command-commit/v1",
    recoveryId,
    folder,
    beforeData: host.beforeData,
    afterData: host.afterData,
    notes: effects,
  };
}

function economyIdentity(value: EconomyState | undefined): string {
  return JSON.stringify({
    configurationRevision: value?.configurationRevision ?? 0,
    definition: value?.definition ?? defaultEconomyDefinition(),
    usages: value?.usages ?? [], usageTombstones: value?.usageTombstones ?? {},
    redemptions: value?.redemptions ?? [], droppedUsages: value?.droppedUsages ?? 0,
  });
}
function accountIdentity(player: Player | undefined): string {
  return JSON.stringify([
    player?.coins ?? 0, player?.xp ?? 0, player?.reputation ?? 0, player?.rewardClaims ?? [],
    player?.registeredAt ?? "", player?.presenceSeconds ?? 0, player?.rewardedMinutes ?? 0,
    player?.registeredPresenceSeconds ?? 0, player?.rewardedXpMinutes ?? 0,
  ]);
}
/** Currency, progress and presence receipts use a proven data boundary even without note effects. */
export function needsAtomicCommand(next: InternalState, previous: InternalState | null, options: SaveOptions): boolean {
  if (options.atomicCommand) return true;
  if (!previous || options.replaceAll || options.replaceProjectId || options.exampleCleanup || options.fromNotes?.length || options.fromProjects?.length || options.requestValuesEdit) return false;
  if (economyIdentity(next.population.economy) !== economyIdentity(previous.population.economy)
    || JSON.stringify(next.population.rules) !== JSON.stringify(previous.population.rules)
    || JSON.stringify(next.population.presenceSamples) !== JSON.stringify(previous.population.presenceSamples)) return true;
  const oldRewards = new Set(previous.population.rewards.map(reward => reward.id));
  if (next.population.rewards.some(reward => !oldRewards.has(reward.id))) return true;
  const oldPlayers = new Map(previous.population.players.map(player => [player.id, player]));
  const nextPlayers = new Map(next.population.players.map(player => [player.id, player]));
  return [...new Set([...oldPlayers.keys(), ...nextPlayers.keys()])].some(id => accountIdentity(oldPlayers.get(id)) !== accountIdentity(nextPlayers.get(id)));
}
