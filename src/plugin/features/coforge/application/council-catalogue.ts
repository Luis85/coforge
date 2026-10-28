import {
  councilDocumentCheck,
  teamDefinitionCheck,
  type CouncilDefinitionDocument,
} from "../domain/council-definitions";
import type { CouncilDefinitionFolders } from "../domain/council-definition-folders";

export interface CouncilFolderPreview {
  folders: CouncilDefinitionFolders;
  definitionCount: number;
  invalid: Array<{ path: string; reason: string }>;
}
export interface CouncilFolderActions {
  preview(folders: CouncilDefinitionFolders): Promise<CouncilFolderPreview>;
  configure(
    folders: CouncilDefinitionFolders,
    expectedRevision: number,
  ): Promise<void>;
}

export interface CouncilCatalogueEntry {
  path: string;
  definition: CouncilDefinitionDocument;
  revision: string;
}
export interface CouncilCatalogueSnapshot {
  valid: CouncilCatalogueEntry[];
  invalid: Array<{ path: string; reason: string }>;
}
export interface CouncilImportPreview {
  definition: CouncilDefinitionDocument;
  previous?: CouncilDefinitionDocument;
  catalogueRevision: string;
  summary: string;
}
export interface CouncilCatalogueStorage {
  scan(): Promise<CouncilCatalogueSnapshot>;
  save(
    definition: CouncilDefinitionDocument,
    expectedRevision?: string,
  ): Promise<void>;
  open(id: string): Promise<void>;
}
export interface CouncilCatalogueActions {
  dependencies?(id: string): Promise<CouncilDependencySnapshot>;
  list(): Promise<CouncilCatalogueSnapshot>;
  save(
    definition: CouncilDefinitionDocument,
    expectedRevision?: string,
  ): Promise<CouncilCatalogueSnapshot>;
  duplicate(id: string, newId: string): Promise<CouncilCatalogueSnapshot>;
  archive(
    id: string,
    expectedRevision: string,
  ): Promise<CouncilCatalogueSnapshot>;
  open(id: string): Promise<void>;
  previewImport(json: string): Promise<CouncilImportPreview>;
  applyImport(preview: CouncilImportPreview): Promise<CouncilCatalogueSnapshot>;
  export(id: string): Promise<string>;
  setup(projectId: string): Promise<CouncilCatalogueSnapshot>;
}
export interface CouncilDependency {
  kind: "team" | "council" | "workflow" | "inbox";
  id: string;
  name: string;
  enabled: boolean;
}
export interface CouncilDependencySnapshot {
  items: CouncilDependency[];
  complete: boolean;
}
function catalogueRevision(snapshot: CouncilCatalogueSnapshot): string {
  return JSON.stringify(
    snapshot.valid.map((item) => [item.definition.id, item.revision]).sort(),
  );
}
function find(
  snapshot: CouncilCatalogueSnapshot,
  id: string,
): CouncilCatalogueEntry {
  const entry = snapshot.valid.find((item) => item.definition.id === id);
  if (!entry)
    throw new Error(
      "This definition is unavailable. Refresh and repair invalid or duplicate notes.",
    );
  return entry;
}
function references(definition: CouncilDefinitionDocument): string[] {
  if (definition.schema === "agent/v1") return [];
  if (definition.schema === "team/v1") return definition.members;
  return [definition.teamId, ...definition.members];
}
function validateReferences(
  definition: CouncilDefinitionDocument,
  snapshot: CouncilCatalogueSnapshot,
): void {
  for (const id of references(definition)) {
    const referenced = snapshot.valid.find(
      (item) => item.definition.id === id,
    )?.definition;
    if (!referenced)
      throw new Error(
        `Referenced definition ${id} is unavailable. Resolve references before saving.`,
      );
    if (definition.schema === "team/v1" && referenced.schema !== "agent/v1")
      throw new Error("Team members must reference agents.");
    if (
      definition.schema === "council/v1" &&
      id !== definition.teamId &&
      referenced.schema !== "agent/v1"
    )
      throw new Error("Council members must reference agents.");
  }
  if (definition.schema === "council/v1") {
    const team = snapshot.valid.find(
      (item) => item.definition.id === definition.teamId,
    )?.definition;
    if (
      team?.schema !== "team/v1" ||
      team.projectId !== definition.projectId ||
      definition.members.some((id) => !team.members.includes(id))
    )
      throw new Error(
        "Council members and project must belong to the selected team.",
      );
  }
}
/** Definitions remain canonical notes. Catalogue state is reconstructed rather than cached as authority. */
export class CouncilCatalogue implements CouncilCatalogueActions {
  constructor(
    private readonly storage: CouncilCatalogueStorage,
    private readonly externalDependencies?: (
      id: string,
    ) => Promise<CouncilDependencySnapshot>,
  ) {}
  async dependencies(id: string): Promise<CouncilDependencySnapshot> {
    const snapshot = await this.list();
    const items = snapshot.valid.flatMap(({ definition }) => {
      if (definition.schema === "agent/v1") return [];
      if (
        !references(definition).includes(id) &&
        !(
          definition.schema === "team/v1" &&
          definition.allowedRecipients.includes(id)
        )
      )
        return [];
      return [
        {
          kind:
            definition.schema === "team/v1"
              ? ("team" as const)
              : ("council" as const),
          id: definition.id,
          name: definition.name,
          enabled: definition.enabled,
        },
      ];
    });
    if (!this.externalDependencies) return { items, complete: false };
    try {
      const external = await this.externalDependencies(id);
      return {
        items: [...items, ...external.items],
        complete: external.complete,
      };
    } catch {
      return { items, complete: false };
    }
  }
  async list(): Promise<CouncilCatalogueSnapshot> {
    const snapshot = await this.storage.scan();
    let changed = true;
    while (changed) {
      changed = false;
      const invalid = new Set<string>();
      for (const entry of snapshot.valid) {
        try {
          validateReferences(entry.definition, snapshot);
        } catch (error) {
          invalid.add(entry.definition.id);
          snapshot.invalid.push({
            path: entry.path,
            reason:
              error instanceof Error
                ? error.message
                : "Repair this definition’s references before using it.",
          });
        }
      }
      if (invalid.size) {
        snapshot.valid = snapshot.valid.filter(
          (entry) => !invalid.has(entry.definition.id),
        );
        changed = true;
      }
    }
    return snapshot;
  }
  async save(
    value: CouncilDefinitionDocument,
    expectedRevision?: string,
  ): Promise<CouncilCatalogueSnapshot> {
    const definition = councilDocumentCheck(value);
    const snapshot = await this.list();
    const current = snapshot.valid.find(
      (item) => item.definition.id === definition.id,
    );
    if (
      current &&
      (expectedRevision === undefined || current.revision !== expectedRevision)
    )
      throw new Error(
        "The definition changed. Refresh before saving; your draft is preserved.",
      );
    if (!current && expectedRevision !== undefined)
      throw new Error(
        "The definition was removed or became invalid. Repair the note before saving.",
      );
    validateReferences(definition, snapshot);
    await this.storage.save(definition, expectedRevision);
    return this.list();
  }
  async duplicate(
    id: string,
    newId: string,
  ): Promise<CouncilCatalogueSnapshot> {
    const entry = find(await this.list(), id);
    if (id === newId) throw new Error("A duplicate needs a new identity.");
    return this.save(
      councilDocumentCheck({
        ...structuredClone(entry.definition),
        id: newId,
        name: `${entry.definition.name} copy`,
        enabled: false,
      }),
    );
  }
  async archive(
    id: string,
    expectedRevision: string,
  ): Promise<CouncilCatalogueSnapshot> {
    const snapshot = await this.list();
    const entry = find(snapshot, id);
    const dependencies = snapshot.valid.filter(
      (item) =>
        item.definition.enabled && references(item.definition).includes(id),
    );
    if (dependencies.length)
      throw new Error(
        `Archive dependent definitions first: ${dependencies.map((item) => item.definition.name).join(", ")}.`,
      );
    return this.save({ ...entry.definition, enabled: false }, expectedRevision);
  }
  open(id: string): Promise<void> {
    return this.storage.open(id);
  }
  async previewImport(json: string): Promise<CouncilImportPreview> {
    if (json.length > 400000)
      throw new Error("Definition import exceeds its size limit.");
    const envelope = JSON.parse(json) as unknown;
    if (
      !envelope ||
      typeof envelope !== "object" ||
      !("format" in envelope) ||
      envelope.format !== "coforge-definition/v1" ||
      !("definition" in envelope) ||
      Object.keys(envelope).some(
        (key) => !["format", "definition"].includes(key),
      )
    )
      throw new Error("Unsupported definition export format.");
    const definition = councilDocumentCheck({
      ...councilDocumentCheck(envelope.definition),
      enabled: false,
    });
    const snapshot = await this.list();
    validateReferences(definition, snapshot);
    const previous = snapshot.valid.find(
      (item) => item.definition.id === definition.id,
    )?.definition;
    return {
      definition,
      ...(previous ? { previous: structuredClone(previous) } : {}),
      catalogueRevision: catalogueRevision(snapshot),
      summary: `${previous ? "Replace" : "Create"} ${definition.name}. Imported definitions remain disabled until local permissions and connections are reviewed.`,
    };
  }
  async applyImport(
    preview: CouncilImportPreview,
  ): Promise<CouncilCatalogueSnapshot> {
    const snapshot = await this.list();
    if (catalogueRevision(snapshot) !== preview.catalogueRevision)
      throw new Error(
        "Definitions changed after preview. Preview the import again.",
      );
    const current = snapshot.valid.find(
      (item) => item.definition.id === preview.definition.id,
    );
    return this.save(
      { ...preview.definition, enabled: false },
      current?.revision,
    );
  }
  async export(id: string): Promise<string> {
    const definition = find(await this.list(), id).definition;
    return JSON.stringify(
      { format: "coforge-definition/v1", definition },
      null,
      2,
    );
  }
  async setup(projectId: string): Promise<CouncilCatalogueSnapshot> {
    const snapshot = await this.list();
    if (
      snapshot.valid.some(
        (item) =>
          item.definition.schema === "team/v1" &&
          item.definition.projectId === projectId,
      )
    )
      return snapshot;
    const team = teamDefinitionCheck({
      schema: "team/v1",
      id: `team-${projectId}`,
      name: "Studio team",
      enabled: true,
      projectId,
      members: [],
      pinnedContext: [],
      recentMessages: 10,
      allowedRecipients: [],
    });
    await this.storage.save(team);
    return this.list();
  }
}
