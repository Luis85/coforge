import { computed } from 'vue';
import type { WorkflowPage } from '../../stores/studio-pages';
import type { WorkflowEditorModel } from './use-workflow-editor';

/** The shared model also drives standalone validation repairs into the right pane. */
export function useWorkflowEditorPane(props: { pane?: WorkflowPage }, model: WorkflowEditorModel) {
  return computed(() => props.pane ?? (['settings', 'limits', 'templates'].includes(model.store.workflowTool) ? model.store.workflowTool : 'settings'));
}
