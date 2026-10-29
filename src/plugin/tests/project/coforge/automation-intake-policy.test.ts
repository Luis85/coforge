// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { councilControlsFixture } from './council-controls-fixture';
import { AUTOMATION_SOURCE_FOLDER } from '../../../features/coforge/domain/workflow-triggers';

it('rejects watched inbox scopes covering generated automation sources without changing saved preferences', async () => {
  const f = await councilControlsFixture();
  try {
    const before = f.module.actions.snapshot().preferences;
    await expect(f.module.actions.saveBindings([{ id: 'automation-watch', path: AUTOMATION_SOURCE_FOLDER, projectId: f.projectId, teamId: f.target.teamId, target: { kind: f.target.kind, id: f.target.id }, enabled: true, recursive: true, submit: 'after-stable', settleMs: 0 }], before.revision)).rejects.toThrow('output folder');
    expect(f.module.actions.snapshot().preferences).toEqual(before);
  } finally { await f.dispose(); }
});
