import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type ComponentPublicInstance } from 'vue';
import type { Idea } from '../../../features/coforge/domain/types';
import { useStudioStore } from '../../stores/coforge-studio';
import { useCoforge } from '../../context/coforge-context';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { formatTime } from './format';
import { codingProfileDisplay, MCP_COMMAND_EVIDENCE_HELP, PROVIDER_TOOL_EVIDENCE_HELP } from './coding-profile-display';
import { ideaSessionJobs, nativeSessionProvider, observedSessionChildren, sessionCaptureHint, sessionElapsed, sessionEventView, sessionObservation, sessionProviderLabel, sessionTitle } from './agent-session-display';

export function useIdeaSessions(props: { idea: Idea }) {
  const store = useStudioStore(); const { host } = useCoforge();
  const selected = ref(''); const childId = ref(''); const now = ref(Date.now());
  const terminalPending = ref(false); const terminalError = ref('');
  let generation = 0; let heading: HTMLElement | null = null; let timer: number | undefined;
  const jobs = computed(() => ideaSessionJobs(store.state, props.idea));
  const job = computed(() => jobs.value.find(job => job.id === selected.value) ?? jobs.value.find(job => job.status === 'running') ?? jobs.value[0]);
  const observation = computed(() => job.value ? sessionObservation(store.state, job.value) : undefined);
  const children = computed(() => job.value && nativeSessionProvider(job.value) ? observedSessionChildren(observation.value?.trace) : []);
  const child = computed(() => children.value.find(child => child.id === childId.value));
  watch(() => jobs.value.map(job => job.id).join(','), () => { if (!jobs.value.some(job => job.id === selected.value)) selected.value = jobs.value.find(job => job.status === 'running')?.id ?? jobs.value[0]?.id ?? ''; }, { immediate: true });
  watch(() => props.idea.id, () => { selected.value = ''; childId.value = ''; });
  watch(() => store.state?.activeProjectId, project => { generation++; terminalPending.value = false; terminalError.value = ''; if (project !== ideaProjectId(props.idea)) store.select(null); });
  watch(() => job.value?.id, () => { generation++; childId.value = ''; terminalPending.value = false; terminalError.value = ''; });
  onMounted(() => { timer = window.setInterval(() => { now.value = Date.now(); }, 1000); });
  onBeforeUnmount(() => { generation++; if (timer !== undefined) window.clearInterval(timer); heading = null; });
  async function select(id: string, nativeId = '') {
    const target = jobs.value.find(job => job.id === id);
    if (!target || nativeId && !observedSessionChildren(sessionObservation(store.state, target).trace).some(child => child.id === nativeId)) return;
    selected.value = id; await nextTick(); childId.value = nativeId;
    await nextTick(); heading?.focus();
  }
  async function terminal() {
    const current = job.value;
    if (!current || !nativeSessionProvider(current) || !observation.value?.trace || !host.sessionFollow || terminalPending.value) return;
    const token = generation; terminalPending.value = true; terminalError.value = '';
    try { await host.sessionFollow.open(current.id); }
    catch { if (token === generation) terminalError.value = 'The read-only terminal follower could not open. Peek remains available.'; }
    finally { if (token === generation) terminalPending.value = false; }
  }
  return reactive({ job, childId, child, terminalPending, terminalError,
    codingProfile: computed(() => job.value?.workflow?.worktreeCoding ? codingProfileDisplay(job.value.workflow.worktreeCoding) : undefined),
    providerToolEvidenceHelp: PROVIDER_TOOL_EVIDENCE_HELP,
    mcpCommandEvidenceHelp: MCP_COMMAND_EVIDENCE_HELP,
    rows: computed(() => jobs.value.map(job => ({ id: job.id, title: sessionTitle(job), provider: sessionProviderLabel(job), status: job.status, model: job.provider === 'demo' ? 'No model call' : job.provider === 'mcp' ? 'Client model not reported' : job.model ?? job.workflow?.step.model ?? 'Model not recorded',
      started: formatTime(job.startedAt), children: nativeSessionProvider(job) ? observedSessionChildren(sessionObservation(store.state, job).trace) : [] }))),
    title: computed(() => child.value?.label ?? (childId.value ? 'Observed native assistant · earlier metadata unavailable' : job.value ? sessionTitle(job.value) : 'Choose a session')),
    provider: computed(() => job.value ? sessionProviderLabel(job.value) : ''),
    captureHint: computed(() => job.value ? sessionCaptureHint(job.value, observation.value?.trace) : ''),
    elapsed: computed(() => job.value ? sessionElapsed(job.value, now.value) : ''),
    lastObserved: computed(() => observation.value?.trace ? formatTime(observation.value.trace.lastObservedAt) : 'Not captured'),
    truncated: computed(() => observation.value?.trace?.truncated === true),
    captureAvailable: computed(() => !!observation.value?.trace),
    failed: computed(() => ['failed', 'cancelled'].includes(job.value?.status ?? '')),
    childCaptureUnavailable: computed(() => !!job.value && nativeSessionProvider(job.value) && !!(job.value.workflow?.step.nativeTools?.delegation || job.value.workflow?.worktreeCoding?.profile === 'native-worktree-v1') && !children.value.length),
    entries: computed(() => (observation.value?.trace?.events ?? []).filter(event => !childId.value || event.sessionId === childId.value).map(event => ({ ...sessionEventView(event, children.value), ...(job.value?.provider === 'mcp' ? { actor: 'Host MCP observation' } : {}) }))),
    selectionKey: computed(() => `${props.idea.id}:${job.value?.id ?? ''}:${childId.value}`),
    verification: computed(() => observation.value?.verification ?? []),
    terminalAvailable: computed(() => !!host.sessionFollow && !!job.value && nativeSessionProvider(job.value) && !!observation.value?.trace),
    incrementAvailable: computed(() => !!props.idea.increment && !['failed', 'cancelled'].includes(job.value?.status ?? '')),
    select: (id: string, nativeId = '') => { void select(id, nativeId); },
    bindHeading: (value: Element | ComponentPublicInstance | null) => { heading = value instanceof HTMLElement ? value : null; },
    terminal: () => { void terminal(); },
    increment: () => { if (store.state?.activeProjectId === ideaProjectId(props.idea)) store.select(props.idea.id, 'increment'); },
    activity: () => { if (job.value) store.inspectJob(props.idea.id, job.value.id); },
  });
}
export type IdeaSessionsModel = ReturnType<typeof useIdeaSessions>;
