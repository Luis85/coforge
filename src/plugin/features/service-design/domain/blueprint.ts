export const BLUEPRINT_KINDS = [
  'blueprint', 'journey-step', 'customer-action', 'frontstage-action',
  'backstage-action', 'support-process', 'evidence', 'actor', 'touchpoint',
  'system', 'pain-point', 'opportunity',
] as const;
export type BlueprintKind = typeof BLUEPRINT_KINDS[number];
export const BLUEPRINT_LAYERS: readonly BlueprintKind[] = [
  'evidence', 'customer-action', 'frontstage-action', 'backstage-action', 'support-process',
];
export const BLUEPRINT_LABELS: Record<BlueprintKind, string> = {
  blueprint: 'Service blueprint', 'journey-step': 'Journey step',
  'customer-action': 'Customer action', 'frontstage-action': 'Frontstage action',
  'backstage-action': 'Backstage action', 'support-process': 'Support process',
  evidence: 'Physical / digital evidence', actor: 'Actor / role',
  touchpoint: 'Touchpoint / channel', system: 'System',
  'pain-point': 'Pain point', opportunity: 'Opportunity',
};
export interface BlueprintInput {
  id?: string;
  version?: string;
  kind: BlueprintKind;
  title: string;
  body: string;
  order: number;
  stepId: string;
  links: string[];
}
export interface BlueprintNote extends BlueprintInput {
  id: string;
  projectId: string;
  blueprintId: string;
  path: string;
  version: string;
}
export interface BlueprintCatalogue {
  folder: string;
  notes: BlueprintNote[];
  warnings: string[];
}
export interface BlueprintRepository {
  load(): Promise<BlueprintCatalogue>;
  configure(folder: string): Promise<void>;
  save(note: BlueprintNote): Promise<BlueprintNote>;
  open(id: string): Promise<void>;
}
export interface ServiceDesignActions {
  load(): Promise<BlueprintCatalogue>;
  configure(folder: string): Promise<BlueprintCatalogue>;
  save(projectId: string, input: BlueprintInput): Promise<BlueprintNote>;
  open(id: string): Promise<void>;
}
export function isBlueprintKind(value: unknown): value is BlueprintKind {
  return BLUEPRINT_KINDS.some(kind => kind === value);
}
export function blueprintId(value: string): boolean {
  return /^[a-zA-Z0-9-]{1,100}$/.test(value) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value);
}
export function blueprintFolder(value: string): string {
  const folder = value.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (!folder || folder.length > 240 || folder.split('/').some(part =>
    !part || part.startsWith('.') || part !== part.trim() || part.endsWith('.') ||
    [...part].some(char => ':*?"<>|[]#^'.includes(char) || char.charCodeAt(0) < 32) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))
    throw new Error('Choose a relative vault folder without hidden, reserved or parent folders.');
  return folder;
}
export function validateBlueprintInput(input: BlueprintInput): void {
  if (!isBlueprintKind(input.kind)) throw new Error('Choose a supported Service Blueprint entity type.');
  if (!input.title.trim() || input.title.length > 200 || ['\r', '\n', '\0'].some(char => input.title.includes(char)))
    throw new Error('Give this entity a title of up to 200 characters.');
  if (input.body.length > 100000) throw new Error('Keep Markdown notes below 100,000 characters.');
  if (!Number.isSafeInteger(input.order) || input.order < 0 || input.order > 100000)
    throw new Error('Choose an order between 0 and 100,000.');
  if (input.links.length > 100 || input.links.some(id => !blueprintId(id)) || new Set(input.links).size !== input.links.length)
    throw new Error('Choose up to 100 distinct linked entities.');
  if (input.stepId && !blueprintId(input.stepId)) throw new Error('Choose a valid journey step.');
}

/** Imported notes must satisfy the same graph rules as authored notes. */
export function blueprintRelationshipWarnings(notes: readonly BlueprintNote[]): string[] {
  const byId = new Map(notes.map(note => [note.id, note]));
  const blueprints = new Map<string, BlueprintNote[]>();
  for (const note of notes) if (note.kind === 'blueprint') {
    const group = blueprints.get(note.projectId) ?? [];
    group.push(note); blueprints.set(note.projectId, group);
  }
  return notes.flatMap(note => {
    const blueprint = byId.get(note.blueprintId);
    const belongs = (id: string) => {
      const target = byId.get(id);
      return target?.projectId === note.projectId && target.blueprintId === note.blueprintId ? target : undefined;
    };
    const step = note.stepId ? belongs(note.stepId) : undefined;
    const invalid = blueprint?.kind !== 'blueprint' || blueprint.projectId !== note.projectId
      || blueprint.blueprintId !== blueprint.id || blueprints.get(note.projectId)?.length !== 1
      || (note.kind === 'blueprint' && note.blueprintId !== note.id)
      || ((note.kind === 'blueprint' || note.kind === 'journey-step') && Boolean(note.stepId))
      || (BLUEPRINT_LAYERS.includes(note.kind) && !note.stepId)
      || (Boolean(note.stepId) && step?.kind !== 'journey-step')
      || note.links.some(id => id === note.id || !belongs(id));
    return invalid ? [`Invalid Service Design relationships: ${note.path || note.id}`] : [];
  });
}
