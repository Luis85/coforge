import {
  BLUEPRINT_LAYERS, blueprintId, blueprintRelationshipWarnings, validateBlueprintInput,
  type BlueprintInput, type BlueprintNote, type BlueprintRepository,
  type ServiceDesignActions,
} from '../domain/blueprint';

/** Project ownership and relationships are validated before canonical note writes. */
export class ServiceDesign implements ServiceDesignActions {
  private busy = false;
  constructor(
    private readonly repository: BlueprintRepository,
    private readonly newId: () => string,
    private readonly projectExists: (id: string) => boolean,
  ) {}
  private async read() {
    const catalogue = await this.repository.load();
    return { ...catalogue, warnings: [...new Set([...catalogue.warnings, ...blueprintRelationshipWarnings(catalogue.notes)])],
      notes: catalogue.notes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)) };
  }
  load() { return this.serial(() => this.read()); }
  private async serial<T>(work: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('A Service Design update is in progress. Try again when it finishes.');
    this.busy = true;
    try { return await work(); } finally { this.busy = false; }
  }
  configure(folder: string) {
    return this.serial(async () => { await this.repository.configure(folder); return this.read(); });
  }
  save(projectId: string, source: BlueprintInput): Promise<BlueprintNote> {
    const input = { ...source, links: [...source.links] };
    return this.serial(async () => {
      if (!blueprintId(projectId) || !this.projectExists(projectId)) throw new Error('Choose an existing project.');
      validateBlueprintInput(input);
      const { notes, warnings } = await this.read();
      if (warnings.length) throw new Error('Resolve invalid or duplicate Service Design notes, then Refresh before saving.');
      const existing = input.id ? notes.find(note => note.id === input.id) : undefined;
      if (input.id && (!existing || existing.version !== input.version))
        throw new Error('This note changed or is missing. Refresh, then reopen the saved note before saving. Your draft is retained.');
      if (existing && existing.projectId !== projectId) throw new Error('This entity belongs to another project.');
      if (existing && existing.kind !== input.kind) throw new Error('An existing entity cannot change its type.');
      const blueprints = notes.filter(note => note.projectId === projectId && note.kind === 'blueprint');
      if (blueprints.length > 1 || (input.kind === 'blueprint' && !existing && blueprints.length))
        throw new Error('Each project can have only one blueprint. Open its existing blueprint.');
      if (input.kind !== 'blueprint' && !blueprints.length) throw new Error('Create this project’s service blueprint first.');
      const id = existing?.id ?? this.newId();
      if (!blueprintId(id) || (!existing && notes.some(note => note.id === id))) throw new Error('A unique entity ID could not be created. Try again.');
      const blueprint = input.kind === 'blueprint' ? id : blueprints[0]!.id;
      const belongs = (targetId: string) => notes.find(note => note.id === targetId && note.projectId === projectId && note.blueprintId === blueprint);
      if (input.kind === 'blueprint' || input.kind === 'journey-step') {
        if (input.stepId) throw new Error('Blueprints and journey steps cannot belong to another step.');
      } else if (BLUEPRINT_LAYERS.includes(input.kind) && !input.stepId) throw new Error('Choose a journey step for this blueprint layer.');
      if (input.stepId && belongs(input.stepId)?.kind !== 'journey-step') throw new Error('Choose a journey step from the same blueprint.');
      if (input.links.some(target => target === id || !belongs(target))) throw new Error('Link distinct entities from the same blueprint.');
      if (!this.projectExists(projectId)) throw new Error('This project is no longer available. Refresh before saving.');
      return this.repository.save({ ...input, title: input.title.trim(), id, projectId,
        blueprintId: blueprint, links: [...input.links], path: existing?.path ?? '', version: existing?.version ?? '' });
    });
  }
  open(id: string) { return this.repository.open(id); }
}
