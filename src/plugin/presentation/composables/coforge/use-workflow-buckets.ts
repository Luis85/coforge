import { computed, reactive, ref, watch, type Ref } from 'vue';
import type { WorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { addWorkflowBucket, assignWorkflowStepBucket, moveWorkflowBucket, removeWorkflowBucket } from '../../stores/workflow-bucket-draft';
import type { useWorkflowEditorVisibility } from './use-workflow-editor-visibility';

interface BucketContext {
  draft: Ref<WorkflowDefinition>;
  selectedId: Ref<string>;
  notice: Ref<string>;
  visibility: ReturnType<typeof useWorkflowEditorVisibility>;
}

/** Bucket selection shares the step detail pane without changing execution or saved state. */
export function useWorkflowBuckets(context: BucketContext) {
  const selectedBucketId = ref('');
  const selectedBucket = computed(() => context.draft.value.buckets?.find(bucket => bucket.id === selectedBucketId.value));
  const activeBucket = computed(() => selectedBucket.value ?? context.draft.value.buckets?.find(bucket =>
    bucket.id === context.draft.value.steps.find(step => step.id === context.selectedId.value)?.bucketId));
  const rows = computed(() => (context.draft.value.buckets ?? []).map((bucket, index) => ({
    ...bucket, index, steps: context.draft.value.steps.filter(step => step.bucketId === bucket.id),
  })));
  watch(context.selectedId, id => { if (id) selectedBucketId.value = ''; }, { flush: 'sync' });
  watch(context.draft, definition => {
    if (!definition.buckets?.some(bucket => bucket.id === selectedBucketId.value)) selectedBucketId.value = '';
  });
  function selectBucket(id: string) {
    if (!context.draft.value.buckets?.some(bucket => bucket.id === id)) return;
    context.selectedId.value = '';
    selectedBucketId.value = id;
    context.visibility.reveal();
  }
  return reactive({
    descriptionPrefix: `cf-workflow-bucket-${crypto.randomUUID()}`,
    rows, selectedBucket, selectedBucketId, activeBucket,
    canAddStep: computed(() => Boolean(activeBucket.value && activeBucket.value.role !== 'accepted' && context.draft.value.steps.length < 40)),
    selectBucket,
    addBucket: () => {
      const bucket = addWorkflowBucket(context.draft.value);
      if (bucket) { selectBucket(bucket.id); context.notice.value = `Added ${bucket.name} before Accepted. Save workflow to apply it.`; }
    },
    moveBucket: (id: string, direction: -1 | 1) => context.visibility.retainMoveFocus(id, () => {
      if (!moveWorkflowBucket(context.draft.value, id, direction)) return;
      const index = context.draft.value.buckets?.findIndex(bucket => bucket.id === id) ?? 0;
      const name = context.draft.value.buckets?.[index]?.name ?? 'Bucket';
      context.notice.value = `${name} moved to bucket ${index + 1} of ${context.draft.value.buckets?.length}. Review any previous-result dependencies before saving.`;
    }),
    removeBucket: (id: string) => {
      const index = context.draft.value.buckets?.findIndex(bucket => bucket.id === id) ?? 0;
      if (!removeWorkflowBucket(context.draft.value, id)) return;
      const survivor = context.draft.value.buckets?.[Math.max(0, index - 1)]?.id ?? '';
      selectBucket(survivor);
      context.visibility.focusListRow(survivor);
      context.notice.value = 'Empty bucket removed from the draft.';
    },
    moveStepToBucket: (event: Event) => {
      const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
      if (!assignWorkflowStepBucket(context.draft.value, context.selectedId.value, value)) return;
      context.notice.value = `Step moved to ${activeBucket.value?.name}. Review any previous-result dependencies before saving.`;
    },
  });
}
