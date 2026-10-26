import { computed, reactive, ref } from 'vue';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { validateProjectPath, validateProjectUrl } from '../../../features/coforge/domain/project-note';
import { useStudioStore } from '../../stores/coforge-studio';
import { useStudioActions } from './use-studio-actions';

/** One stream, many project boards. New projects start paused; switches never stop the shared worker. */
export function useProjects() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const adding = ref(false);
  const error = ref('');
  const draft = reactive({ projectName: '', projectBrief: '', projectPath: '', repositoryUrl: '', websiteUrl: '' });
  const rows = computed(() => (store.state?.projects ?? []).map(project => {
    const ideas = (store.state?.ideas ?? []).filter(idea => ideaProjectId(idea) === project.id);
    const jobs = (store.state?.jobs ?? []).filter(job => job.projectId === project.id && (job.status === 'queued' || job.status === 'running'));
    return { id: project.id, name: project.settings.projectName, path: project.projectPath, brief: project.settings.projectBrief,
      repositoryUrl: project.repositoryUrl, repositoryHref: /^https?:\/\//i.test(project.repositoryUrl) ? project.repositoryUrl : undefined, websiteUrl: project.websiteUrl,
      selected: project.id === store.state?.activeProjectId, unavailable: project.unavailable, requests: ideas.length,
      review: ideas.filter(idea => idea.status === 'review').length, jobs: jobs.length,
      status: project.unavailable ? 'Restore project note' : jobs.length ? 'Agent work in progress' : project.settings.paused ? 'Automation paused' : 'Automation resumed' };
  }));

  async function create(): Promise<void> {
    if (store.busy) return;
    error.value = '';
    try { validateProjectPath(draft.projectPath, true); validateProjectUrl(draft.repositoryUrl, true); validateProjectUrl(draft.websiteUrl); }
    catch (problem) { error.value = problem instanceof Error ? problem.message : 'Enter a valid project path.'; return; }
    if (await actions.createProject({ ...draft })) {
      Object.assign(draft, { projectName: '', projectBrief: '', projectPath: '', repositoryUrl: '', websiteUrl: '' });
      adding.value = false; store.navigate('board');
    } else error.value = store.toasts.at(-1)?.message ?? 'The project could not be saved. Your draft is kept.';
  }
  async function open(id: string, settings = false): Promise<void> {
    if (await actions.selectProject(id)) store.navigate(settings ? 'settings' : 'board');
  }
  return reactive({
    store, rows, draft, adding, error,
    add: () => { adding.value = true; error.value = ''; },
    cancel: () => { adding.value = false; error.value = ''; },
    submit: (event: Event) => { event.preventDefault(); void create(); },
    open: (id: string) => { void open(id); },
    edit: (id: string) => { void open(id, true); },
  });
}
