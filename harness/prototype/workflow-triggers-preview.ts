import { WorkflowTriggers } from '../../src/plugin/features/coforge/application/workflow-triggers';
import { emptyWorkflowTriggers } from '../../src/plugin/features/coforge/domain/workflow-triggers';
import { workflowDefinition } from '../../src/plugin/features/coforge/domain/configured-workflow';
import type { CouncilActions } from '../../src/plugin/features/coforge/application/council-ports';
import type { StudioStore } from '../../src/plugin/features/coforge/application/studio-store';
/** Explicit memory-only browser example; no provider, native tools or vault writes. */
export function createWorkflowTriggersPreview(studio: StudioStore, council: CouncilActions): WorkflowTriggers {
  let state = emptyWorkflowTriggers();
  const service = new WorkflowTriggers({ load: async () => structuredClone(state), save: async value => { state = structuredClone(value); } }, {
    owned: () => council.snapshot().executor,
    configure: async () => { if (!council.snapshot().executor) throw new Error('Designate the example desktop first.'); },
    readiness: () => ({ ready: false, reason: 'Browser example never dispatches providers.' }), active: () => false, subscribe: () => () => {},
    describe: async input => {
      const project = studio.snapshot().projects?.find(project => project.id === input.projectId);
      if (!project) throw new Error('Choose an example project.');
      if (input.workflow === 'v1') { const definition = workflowDefinition(project.settings); return { revision: definition.revision, definitionJson: JSON.stringify(definition), subject: 'idea' }; }
      const saved = await council.workflows.load(input.projectId);
      if (!saved.definition) throw new Error('Save a Council workflow example first.');
      return { revision: saved.definition.revision, definitionJson: JSON.stringify(saved.definition), subject: saved.definition.subjectMode === 'note' ? 'note' : 'idea' };
    },
    dispatch: async () => { throw new Error('The browser example cannot dispatch work.'); },
  });
  void service.start().catch(() => undefined); return service;
}
