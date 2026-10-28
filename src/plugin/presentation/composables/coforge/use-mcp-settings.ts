import { computed, reactive, ref, watch } from 'vue';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';

export function useMcpSettings() {
  const { host } = useCoforge();
  const store = useStudioStore();
  const busy = ref(false);
  const error = ref('');
  const revision = ref(0);
  const recoveryTaskId = ref('');
  const reviewed = ref(false);
  const status = computed(() => { void revision.value; void store.state?.jobs; return host.mcp?.status(); });
  watch(() => status.value?.recovery, () => { recoveryTaskId.value = status.value?.recovery?.[0]?.taskId ?? ''; reviewed.value = false; }, { immediate: true });
  async function change(activate: boolean): Promise<void> {
    if (busy.value || !host.mcp) return;
    busy.value = true; error.value = '';
    try { if (activate) await host.mcp.activate(); else await host.mcp.deactivate(); }
    catch (failure) { error.value = failure instanceof Error ? failure.message : 'MCP settings could not be updated. Inspect the configuration and retry.'; }
    finally { busy.value = false; revision.value++; }
  }
  async function recover(): Promise<void> {
    if (busy.value || !reviewed.value || !host.mcp?.recover || !recoveryTaskId.value) return;
    busy.value = true; error.value = '';
    try { await host.mcp.recover(recoveryTaskId.value); revision.value++; }
    catch (failure) { error.value = failure instanceof Error ? failure.message : 'Inspect the workspace before retrying recovery.'; }
    finally { busy.value = false; }
  }
  return reactive({ busy, error, status, recoveryTaskId, reviewed,
    recover: () => { void recover(); }, unavailable: computed(() => !host.mcp),
    activate: () => { void change(true); }, deactivate: () => { void change(false); } });
}
