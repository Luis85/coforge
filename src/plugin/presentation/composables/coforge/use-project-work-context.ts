import { computed, reactive } from 'vue';
import { useStudioStore } from '../../stores/coforge-studio';
import { projectWorkSummary } from './project-work-summary';

/** Shared context for project-owned work; navigation uses the existing dirty-draft guard. */
export function useProjectWorkContext() {
  const store = useStudioStore();
  return reactive({
    summary: computed(() => projectWorkSummary(store.state)),
    openProjects: () => store.navigate('projects'),
  });
}
