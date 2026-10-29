// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin, parseYaml } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { VaultServiceDesign } from '../../../infrastructure/coforge/vault-service-design';
import { ServiceDesign } from '../../../features/service-design/application/service-design';
import { splitNote } from '../../../infrastructure/coforge/markdown';
import type { BlueprintInput } from '../../../features/service-design/domain/blueprint';

function kit(files: Record<string, string> = {}) {
  const app = new App();
  const test = createTestApp({ app, files, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const repository = new VaultServiceDesign(plugin, () => ({ ideasFolder: 'CoForge/Ideas', publicFolder: 'CoForge/Public' }), () => []);
  let sequence = 0;
  const service = new ServiceDesign(repository, () => `sd-${++sequence}`, id => id === 'CFP-001');
  const input = (kind: BlueprintInput['kind'], extra: Partial<BlueprintInput> = {}): BlueprintInput => ({ kind, title: 'My service', body: '\n# Details\r\n\r\nAuthored **Markdown**.\r\n', order: 0, stepId: '', links: [], ...extra });
  return { app, test, repository, service, input, plugin };
}

describe('canonical Service Design notes', () => {
  it('writes typed notes with stable ownership and Obsidian wikilinks, and reloads them', async () => {
    const { service, input, test, repository, plugin } = kit();
    const blueprint = await service.save('CFP-001', input('blueprint'));
    const step = await service.save('CFP-001', input('journey-step'));
    const action = await service.save('CFP-001', input('customer-action', { stepId: step.id, links: [blueprint.id] }));
    expect(action.path).toBe('CoForge/Service Design/CFP-001/sd-3.md');
    expect(parseYaml(splitNote(test.read(action.path)).yaml!)).toMatchObject({
      type: 'coforge-service-design', schema: 1, id: 'sd-3', kind: 'customer-action', project_id: 'CFP-001', blueprint_id: blueprint.id,
      blueprint: `[[${blueprint.path.slice(0, -3)}]]`, step: `[[${step.path.slice(0, -3)}]]`, related: [`[[${blueprint.path.slice(0, -3)}]]`],
    });
    const reloaded = new VaultServiceDesign(plugin, () => ({ ideasFolder: 'CoForge/Ideas', publicFolder: 'CoForge/Public' }), () => []);
    expect((await reloaded.load()).notes).toHaveLength(3);
    expect((await repository.load()).notes.find(note => note.id === action.id)?.body).toBe(input('customer-action').body);
  });
  it('preserves unrelated properties and exact Markdown on metadata edits and rejects concurrent external edits', async () => {
    const { service, input, app, test } = kit();
    const blueprint = await service.save('CFP-001', input('blueprint'));
    const file = app.vault.getFileByPath(blueprint.path)!;
    await app.vault.process(file, content => content.replace('schema: 1', 'custom: retain\nschema: 1'));
    const refreshed = (await service.load()).notes[0]!;
    const body = splitNote(test.read(file.path)).body;
    await service.save('CFP-001', { ...refreshed, title: 'Updated metadata' });
    expect(splitNote(test.read(file.path)).body).toBe(body);
    expect(parseYaml(splitNote(test.read(file.path)).yaml!)).toMatchObject({ custom: 'retain', title: 'Updated metadata', id: blueprint.id });
    const stale = (await service.load()).notes[0]!;
    await app.vault.process(file, content => content + '\nExternal work.');
    const exact = test.read(file.path);
    await expect(service.save('CFP-001', { ...stale, title: 'Lost update' })).rejects.toThrow('Refresh');
    expect(test.read(file.path)).toBe(exact);
  });
  it('keeps existing roots discoverable after configuring a folder and after reload', async () => {
    const { service, input, plugin, test } = kit();
    const blueprint = await service.save('CFP-001', input('blueprint'));
    await service.configure('Private/Services');
    const step = await service.save('CFP-001', input('journey-step'));
    expect(step.path).toBe('Private/Services/CFP-001/sd-2.md');
    const reloaded = new VaultServiceDesign(plugin, () => ({ ideasFolder: 'CoForge/Ideas', publicFolder: 'CoForge/Public' }), () => []);
    expect((await reloaded.load()).notes.map(note => note.id).sort()).toEqual([blueprint.id, step.id]);
    expect(test.read('Private/Services/.gitignore')).toContain('*');
    expect(test.read(blueprint.path)).toContain('kind: blueprint');
  });
  it('rejects traversal, public exports and overlapping managed folders without creating notes', async () => {
    const { service, app } = kit();
    for (const folder of ['../Escape', '/absolute', '.obsidian/Services', 'CoForge/Public/Services', 'CoForge', 'CoForge/Ideas', 'Private/CON'])
      await expect(service.configure(folder)).rejects.toThrow();
    expect(app.vault.getMarkdownFiles()).toHaveLength(0);
  });
  it('reports duplicate IDs and invalid owned notes without replacing them or overwriting settings', async () => {
    const { service, input, app, test, repository } = kit();
    const blueprint = await service.save('CFP-001', input('blueprint'));
    await app.vault.create('CoForge/Service Design/duplicate.md', test.read(blueprint.path));
    expect((await repository.load()).warnings.length).toBeGreaterThan(0);
    await expect(service.save('CFP-001', input('journey-step'))).rejects.toThrow('Resolve');
    const settings = '.obsidian/plugins/coforge/coforge-service-design.json';
    await app.vault.adapter.write(settings, '{broken');
    await expect(repository.load()).rejects.toThrow('settings');
    await expect(service.configure('Other/Services')).rejects.toThrow();
    expect(await app.vault.adapter.read(settings)).toBe('{broken');
  });

  it('rejects external edits arriving after refresh but before the atomic write', async () => {
    const { service, input, repository, app, test } = kit();
    const blueprint = await service.save('CFP-001', input('blueprint'));
    const file = app.vault.getFileByPath(blueprint.path)!;
    const saved = (await repository.load()).notes[0]!;
    const process = app.vault.process.bind(app.vault);
    vi.spyOn(app.vault, 'process').mockImplementationOnce(async (target, change) => {
      await process(target, content => content + '\nConcurrent annotation.');
      return process(target, change);
    });
    await expect(repository.save({ ...saved, title: 'Stale metadata' })).rejects.toThrow('Refresh');
    expect(test.read(file.path)).toContain('Concurrent annotation.');
    expect(test.read(file.path)).not.toContain('Stale metadata');
  });

  it('validates identities at the storage boundary before creating folders or notes', async () => {
    const { service, input, repository, app } = kit();
    const blueprint = await service.save('CFP-001', input('blueprint'));
    await expect(repository.save({ ...blueprint, id: 'new-id', version: '', projectId: '../Escape', blueprintId: 'new-id' })).rejects.toThrow();
    await expect(repository.save({ ...blueprint, id: '../Escape', version: '', blueprintId: '../Escape' })).rejects.toThrow();
    expect(app.vault.getMarkdownFiles()).toHaveLength(1);
  });

  it('reports imported broken blueprint relationships and preserves the exact note bytes', async () => {
    const { service, input, app, test, repository } = kit();
    await service.save('CFP-001', input('blueprint'));
    const step = await service.save('CFP-001', input('journey-step'));
    const file = app.vault.getFileByPath(step.path)!;
    await app.vault.process(file, content => content.replace('blueprint_id: sd-1', 'blueprint_id: missing-blueprint'));
    const exact = test.read(file.path);
    expect((await repository.load()).warnings).toEqual(expect.arrayContaining([expect.stringContaining(step.path)]));
    await expect(service.save('CFP-001', input('actor'))).rejects.toThrow('Resolve');
    expect(test.read(file.path)).toBe(exact);
  });

  it('keeps custom-root notes private even when existing ignore rules reinclude Markdown', async () => {
    const { service, test } = kit({ 'Private/Services/.gitignore': '# Human rules\n*\n!*.md\n' });
    await service.configure('Private/Services');
    const ignored = test.read('Private/Services/.gitignore');
    expect(ignored).toMatch(/^# Human rules\n\*\n!\*\.md\n/u);
    expect(ignored).toMatch(/# CoForge private Service Design\n\*\n$/u);
    await service.configure('Private/Services');
    expect(test.read('Private/Services/.gitignore')).toBe(ignored);
  });

  it('reserves a proposed private root during filesystem work and rejects a changed public destination', async () => {
    const { plugin, app } = kit();
    let publicFolder = 'CoForge/Public';
    const repository = new VaultServiceDesign(plugin, () => ({ ideasFolder: 'CoForge/Ideas', publicFolder }), () => []);
    await repository.configure('Existing/Services');
    const settings = '.obsidian/plugins/coforge/coforge-service-design.json';
    const previous = await app.vault.adapter.read(settings);
    const write = app.vault.adapter.write.bind(app.vault.adapter);
    let reserved = false;
    vi.spyOn(app.vault.adapter, 'write').mockImplementation(async (path, content) => {
      if (path === 'Private/Services/.gitignore') {
        reserved = repository.privateFolders().includes('Private/Services');
        publicFolder = 'Private/Services';
      }
      await write(path, content);
    });
    await expect(repository.configure('Private/Services')).rejects.toThrow('public');
    expect(reserved).toBe(true);
    expect(await app.vault.adapter.read(settings)).toBe(previous);
    expect((await repository.load()).folder).toBe('Existing/Services');
    expect(repository.privateFolders()).toContain('Existing/Services');
    expect(repository.privateFolders()).not.toContain('Private/Services');
  });

  it('keeps the previous folder history when saving new root settings fails', async () => {
    const { repository, app } = kit();
    await repository.configure('Existing/Services');
    const settings = '.obsidian/plugins/coforge/coforge-service-design.json';
    const previous = await app.vault.adapter.read(settings);
    const write = app.vault.adapter.write.bind(app.vault.adapter);
    vi.spyOn(app.vault.adapter, 'write').mockImplementation(async (path, content) => {
      if (path === settings) throw new Error('Disk unavailable');
      await write(path, content);
    });
    await expect(repository.configure('Other/Services')).rejects.toThrow('Disk unavailable');
    expect(await app.vault.adapter.read(settings)).toBe(previous);
    expect((await repository.load()).folder).toBe('Existing/Services');
    expect(repository.privateFolders()).not.toContain('Other/Services');
  });
});
