// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { StudioService } from '../../../features/coforge/application/studio';
import { ideaFingerprint } from '../../../features/coforge/domain/integrity';
import { atomicCommandFixture } from './atomic-command-fixture';
import { nodeTimers } from './memory-storage';
import { objectDefinition } from './request-object-fixture';

it('persists owner admission and field edits through the vault adapter without rewriting the note body', async () => {
  const f = await atomicCommandFixture();
  let restored: StudioService | undefined;
  try {
    await f.studio.updateProject({ requestObject: objectDefinition() }, f.studio.state().activeProjectId);
    await f.studio.createIdea({ title: 'Owner request in the vault', description: 'Preserve this authored request.', category: 'Gameplay', username: 'Owner' });
    const idea = f.studio.state().ideas[0]!;
    const file = f.storage.file(idea.id)!;
    const body = f.kit.read(file.path).split('---').slice(2).join('---');
    expect(f.kit.read(file.path)).toContain('screening-provider: owner');
    await f.studio.updateRequestValues(idea.id, { customer: 'Owner edit' }, ideaFingerprint(idea));
    expect(f.kit.read(file.path).split('---').slice(2).join('---')).toBe(body);
    restored = new StudioService(f.storage, { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) },
      probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
    await restored.store.init();
    expect(restored.state().ideas[0]).toMatchObject({ status: 'screened', screening: { provider: 'owner' }, requestObject: { values: { customer: 'Owner edit' } } });
    expect(f.kit.errors).toEqual([]);
  } finally { await restored?.stop(); await f.studio.stop(); document.body.replaceChildren(); }
});
