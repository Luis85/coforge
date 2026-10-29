import { computed, nextTick, reactive, shallowRef, watch, type ComponentPublicInstance } from 'vue';
import { decodeCouncilPlan } from '../../../features/coforge/application/council-execution';
import { decodeWorkflowV2Plan, isWorkflowV2Run } from '../../../features/coforge/application/workflow-v2-execution';
import type { StudioProject } from '../../../features/coforge/domain/types';
import type { ExecutionRun } from '../../../features/coforge/domain/execution-run';
import type { useCouncilStore } from '../../stores/coforge-council';
import { councilTaskTitle } from './council-task-history';

export function councilRunName(run: ExecutionRun): string {
  try { return isWorkflowV2Run(run) ? decodeWorkflowV2Plan(run).definition.name : decodeCouncilPlan(run).definition.name; }
  catch { return 'Retained discussion'; }
}
export function useCouncilRunDisplay(store: ReturnType<typeof useCouncilStore>, selected: () => ExecutionRun | undefined, projects: () => readonly StudioProject[]) {
  const target = shallowRef<HTMLElement | null>(null);
  const focus = () => { const element = target.value; if (element) { element.focus({ preventScroll: true }); element.scrollIntoView({ block: 'start', behavior: 'auto' }); } };
  watch(() => selected()?.id, () => { void nextTick(focus); });
  return reactive({
    bindAnswers: (value: Element | ComponentPublicInstance | null) => {
      const element = value instanceof HTMLElement ? value : null;
      if (element === target.value) return;
      target.value = element;
      if (element) void nextTick(focus);
    },
    title: (run: ExecutionRun) => councilTaskTitle(run.subject.markdown, store.tasks.find(task => task.sourceId === run.subject.sourceId)?.title, run.limits?.simulation),
    council: councilRunName,
    project: (run: ExecutionRun) => { const project = projects().find(item => item.id === run.projectId); return project ? `${project.settings.projectName} (${run.projectId})` : run.projectId; },
    selectedCouncil: computed(() => selected() ? councilRunName(selected()!) : ''),
    published: computed(() => {
      const run = selected();
      return run?.artifacts.filter(artifact => run.attempts.some(attempt => attempt.artifactId === artifact.id && attempt.status === 'published')).sort((a, b) => run.invocations.findIndex(item => item.id === a.invocationId) - run.invocations.findIndex(item => item.id === b.invocationId)) ?? [];
    }),
    unpublished: computed(() => (selected()?.artifacts.length ?? 0) - (selected()?.artifacts.filter(artifact => selected()?.attempts.some(attempt => attempt.artifactId === artifact.id && attempt.status === 'published')).length ?? 0)),
  });
}
