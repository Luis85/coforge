import type { AgentSessionEvent } from '../../features/coforge/domain/agent-session';
import { sessionId, sessionObject, sessionStatus } from './provider-session-safety';

export function codexSessionEvents(emit: (event: AgentSessionEvent) => void) {
  let root: string | undefined; let missingChildren = false;
  const children = new Set<string>();
  return (event: Record<string, unknown>) => {
    const item = sessionObject(event.item);
    const id = sessionId(event.thread_id ?? item.thread_id);
    const parent = sessionId(event.parent_thread_id ?? item.parent_thread_id);
    if (id && id === parent) return;
    const agent = event.agent_name ?? sessionObject(event.agent).agent_name ?? item.agent_name ?? sessionObject(item.agent).agent_name;
    if (agent !== undefined && agent !== '/root' && (!id || !children.has(id) && parent !== root)) {
      if (!missingChildren) { missingChildren = true; emit({ kind: 'notice', sessionId: root, text: 'Native child detail is unavailable in this provider stream.' }); }
      return;
    }
    if (event.type === 'thread.started') {
      if (!root && !parent) root = id;
      else if (id && parent === root && children.size < 64) children.add(id);
      else return;
      emit({ kind: 'session', sessionId: id, parentSessionId: parent, label: parent ? 'Native subagent' : 'Codex', status: 'running' }); return;
    }
    if (id && id !== root && !children.has(id)) return;
    const actor = id ?? root;
    if (event.type === 'turn.completed' || event.type === 'turn.failed') {
      emit({ kind: 'session', sessionId: actor, status: event.type === 'turn.completed' ? 'completed' : 'failed' }); return;
    }
    if (event.type === 'error') { emit({ kind: 'notice', sessionId: actor, text: 'The provider reported a connection or execution notice.' }); return; }
    if (event.type !== 'item.started' && event.type !== 'item.completed') return;
    if (item.type === 'agent_message' && event.type === 'item.completed' && typeof item.text === 'string') emit({ kind: 'message', sessionId: actor, text: item.text });
    if (item.type === 'mcp_tool_call' || item.type === 'command_execution' || item.type === 'file_change')
      emit({ kind: 'tool', sessionId: actor, tool: sessionId(item.tool) ?? String(item.type), status: event.type === 'item.started' ? 'running' : item.status === 'failed' ? 'failed' : 'completed' });
    if (item.type !== 'collab_tool_call') return;
    const receivers = Array.isArray(item.receiver_thread_ids) ? item.receiver_thread_ids.flatMap(value => sessionId(value) ?? []).slice(0, 64) : [];
    if (event.type === 'item.completed' && item.status === 'completed') for (const id of Object.keys(sessionObject(item.agents_states)).slice(0, 64)) if (sessionId(id) && !receivers.includes(id)) receivers.push(id);
    emit({ kind: 'tool', sessionId: actor, tool: sessionId(item.tool) ?? 'native_agent', status: event.type === 'item.started' ? 'running' : sessionStatus(item.status) });
    for (const child of receivers) {
      if (child === root) continue;
      if (children.size >= 64 && !children.has(child)) break;
      const state = sessionObject(sessionObject(item.agents_states)[child]);
      const successful = event.type === 'item.completed' && item.status === 'completed';
      const spawned = successful && (item.tool === 'spawn_agent' || item.tool === 'spawn');
      const observed = successful && state.status && sessionStatus(state.status) !== 'unknown';
      if (!children.has(child) && !spawned && !observed) continue;
      children.add(child);
      if (spawned || observed) emit({ kind: 'session', sessionId: child, parentSessionId: root, label: 'Native subagent', status: observed ? sessionStatus(state.status) : 'running' });
    }
    if (!receivers.length && !missingChildren) {
      missingChildren = true; emit({ kind: 'notice', sessionId: root, text: 'Native child detail is unavailable in this provider stream.' });
    }
  };
}
