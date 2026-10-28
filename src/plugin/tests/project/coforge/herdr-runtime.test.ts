import { describe, expect, it } from 'vitest';
import { emptyHerdr } from '../../../features/coforge/domain/herdr';
import { herdrWorkflowReadiness } from '../../../features/coforge/application/herdr-workflow-readiness';
import type { HerdrWorkflowState } from '../../../features/coforge/application/herdr-workflow-ports';

describe('Herdr runtime readiness', () => {
  it('requires both a loaded workflow journal and a fresh compatible session', () => {
    const manual = emptyHerdr();
    const workflow: HerdrWorkflowState = { ready: true, busy: false, records: [], error: '' };
    const now = Date.now();
    expect(herdrWorkflowReadiness(manual, workflow, now).ready).toBe(false);
    manual.checkedAt = new Date(now).toISOString();
    manual.observation = { running: true, compatible: true, version: '0.9.5', workspaces: [], panes: [], agents: [] };
    expect(herdrWorkflowReadiness(manual, workflow, now)).toMatchObject({ ready: true, busy: false });
    expect(herdrWorkflowReadiness(manual, workflow, now + 30001).ready).toBe(false);
    expect(herdrWorkflowReadiness(manual, { ...workflow, ready: false }, now).ready).toBe(false);
    manual.records.push({ id: 'uncertain', kind: 'workspace-create', projectId: 'CFP-001', session: 'default', at: manual.checkedAt, status: 'uncertain' });
    expect(herdrWorkflowReadiness(manual, workflow, now).ready).toBe(false);
  });
});
