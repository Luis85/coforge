import type { CouncilTaskBinding } from '../../../features/coforge/domain/workflow-council-binding';

export function testCouncilBinding(projectId = 'CFP-001', councilId = 'advice', identity = 'captured-advice'): CouncilTaskBinding {
  return { format: 'coforge-council-binding/v1', projectId, councilId, councilName: 'Advice Council', identity,
    members: [{ id: 'architect', name: 'Architect', provider: 'claude', model: 'sonnet' }],
  };
}
