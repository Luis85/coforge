import { describe, expect, it, vi } from 'vitest';
import { ServiceDesign } from '../../../features/service-design/application/service-design';
import type { BlueprintNote, BlueprintRepository, BlueprintInput } from '../../../features/service-design/domain/blueprint';

function kit() {
  const notes: BlueprintNote[] = [];
  let sequence = 0;
  const repository: BlueprintRepository = {
    load: async () => ({ folder: 'CoForge/Service Design', notes: structuredClone(notes), warnings: [] }),
    configure: async () => {},
    save: async note => {
      const saved = { ...note, path: `${note.id}.md`, version: String(++sequence) };
      const index = notes.findIndex(item => item.id === saved.id);
      if (index < 0) notes.push(saved); else notes[index] = saved;
      return saved;
    },
    open: async () => {},
  };
  const service = new ServiceDesign(repository, () => `sd-${++sequence}`, id => ['CFP-001', 'CFP-002'].includes(id));
  const input = (kind: BlueprintInput['kind'], extra: Partial<BlueprintInput> = {}): BlueprintInput => ({ kind, title: 'Service', body: '', order: 0, stepId: '', links: [], ...extra });
  return { notes, repository, service, input };
}

describe('Service Design project blueprint', () => {
  it('creates ordered steps and every supported entity, retaining project ownership', async () => {
    const { service, input } = kit();
    const blueprint = await service.save('CFP-001', input('blueprint'));
    const step = await service.save('CFP-001', input('journey-step', { title: 'Discover', order: 2 }));
    const first = await service.save('CFP-001', input('journey-step', { title: 'Arrive', order: 1 }));
    for (const kind of ['customer-action', 'frontstage-action', 'backstage-action', 'support-process', 'evidence', 'actor', 'touchpoint', 'system', 'pain-point', 'opportunity'] as const) {
      const note = await service.save('CFP-001', input(kind, { stepId: step.id, links: [first.id] }));
      expect(note).toMatchObject({ projectId: 'CFP-001', blueprintId: blueprint.id, kind, stepId: step.id, links: [first.id] });
    }
    const catalogue = await service.load();
    expect(catalogue.notes.filter(note => note.kind === 'journey-step').map(note => note.title)).toEqual(['Arrive', 'Discover']);
  });

  it('rejects missing blueprints, duplicate blueprints and cross-project relationships without writing', async () => {
    const { service, notes, input } = kit();
    await expect(service.save('missing', input('blueprint'))).rejects.toThrow('project');
    await expect(service.save('CFP-001', input('actor'))).rejects.toThrow('blueprint');
    const blueprint = await service.save('CFP-001', input('blueprint'));
    await expect(service.save('CFP-001', input('blueprint'))).rejects.toThrow('one blueprint');
    await service.save('CFP-002', input('blueprint'));
    const foreign = await service.save('CFP-002', input('journey-step'));
    await expect(service.save('CFP-001', input('customer-action', { stepId: foreign.id }))).rejects.toThrow('same blueprint');
    await expect(service.save('CFP-001', input('actor', { links: [foreign.id] }))).rejects.toThrow('same blueprint');
    await expect(service.save('CFP-002', { ...input('blueprint'), id: blueprint.id, version: blueprint.version })).rejects.toThrow('project');
    expect(notes).toHaveLength(3);
  });

  it('rejects stale editor versions, missing steps and invalid values', async () => {
    const { service, input, notes } = kit();
    const blueprint = await service.save('CFP-001', input('blueprint'));
    await expect(service.save('CFP-001', { ...blueprint, title: 'Changed', version: 'stale' })).rejects.toThrow('Refresh');
    await expect(service.save('CFP-001', input('customer-action'))).rejects.toThrow('journey step');
    await expect(service.save('CFP-001', input('actor', { title: ' ' }))).rejects.toThrow('title');
    await expect(service.save('CFP-001', input('journey-step', { order: -1 }))).rejects.toThrow('order');
    expect(notes).toHaveLength(1);
  });

  it('captures an input before async reads so later draft edits cannot bypass validation', async () => {
    const { service, repository, input } = kit();
    let release = () => {};
    const ready = new Promise<void>(resolve => { release = resolve; });
    const load = repository.load;
    vi.spyOn(repository, 'load').mockImplementation(async () => { await ready; return load(); });
    const draft = input('blueprint', { title: 'Reviewed service' });
    const saving = service.save('CFP-001', draft);
    draft.title = '';
    draft.links.push('missing');
    release();
    await expect(saving).resolves.toMatchObject({ title: 'Reviewed service', links: [] });
  });

  it('blocks writes to a catalogue with externally broken ownership or dependencies', async () => {
    const { service, notes, input } = kit();
    await service.save('CFP-001', input('blueprint'));
    const step = await service.save('CFP-001', input('journey-step'));
    notes.push({ ...step, id: 'broken', kind: 'customer-action', stepId: 'missing-step' });
    await expect(service.save('CFP-001', input('actor'))).rejects.toThrow('Resolve');
    const broken = notes.find(note => note.id === 'broken')!;
    broken.stepId = step.id;
    broken.blueprintId = 'missing-blueprint';
    await expect(service.save('CFP-001', input('actor'))).rejects.toThrow('Resolve');
    broken.blueprintId = notes[0]!.id;
    broken.links = [broken.id];
    await expect(service.save('CFP-001', input('actor'))).rejects.toThrow('Resolve');
    expect(notes).toHaveLength(3);
  });

  it('rejects overlapping saves and releases its gate after a failed write', async () => {
    const { service, repository, input } = kit();
    let release = () => {};
    const ready = new Promise<void>(resolve => { release = resolve; });
    const originalSave = repository.save;
    vi.spyOn(repository, 'save').mockImplementationOnce(async () => { await ready; throw new Error('Disk full'); });
    const first = service.save('CFP-001', input('blueprint'));
    await expect(service.save('CFP-001', input('blueprint'))).rejects.toThrow('in progress');
    await expect(service.load()).rejects.toThrow('in progress');
    release();
    await expect(first).rejects.toThrow('Disk full');
    repository.save = originalSave;
    await expect(service.save('CFP-001', input('blueprint'))).resolves.toMatchObject({ kind: 'blueprint' });
  });
});
