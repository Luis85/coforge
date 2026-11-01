import type { AgentSessionEvent } from '../../features/coforge/domain/agent-session';
import { sessionId, sessionObject, sessionStatus } from './provider-session-safety';

export function claudeSessionEvents(emit: (event: AgentSessionEvent) => void) {
  let root: string | undefined; let associationNotice = false;
  const tasks = new Map<string, string>();
  const requested = new Set<string>();
  const child = (tool: string, status: AgentSessionEvent['status'] = 'running') => {
    const id = `claude-tool:${tool}`;
    if (id.length > 160) return undefined;
    emit({ kind: 'session', sessionId: id, parentSessionId: root, label: 'Tool-linked native assistant', status });
    if (!associationNotice) { associationNotice = true; emit({ kind: 'notice', sessionId: root, text: 'Subagent activity is associated by Agent tool ID; the native child session ID is unavailable.' }); }
    return id;
  };
  return (event: Record<string, unknown>) => {
    const parentTool = sessionId(event.parent_tool_use_id);
    if (!root && !parentTool) root = sessionId(event.session_id);
    if (root && event.session_id && sessionId(event.session_id) !== root && !parentTool) return;
    const actor = parentTool ? child(parentTool) : root;
    if (event.type === 'system' && event.subtype === 'init') emit({ kind: 'session', sessionId: root, label: 'Claude', status: 'running' });
    if (event.type === 'system' && /^(?:task_started|task_progress|task_notification)$/u.test(String(event.subtype))) {
      const task = sessionId(event.task_id), tool = sessionId(event.tool_use_id) ?? (task ? tasks.get(task) : undefined);
      if (!tool) return;
      if (task && tasks.size < 64) tasks.set(task, tool);
      const associated = child(tool, event.subtype === 'task_notification' ? sessionStatus(event.status) : 'running');
      if (event.subtype === 'task_progress' && sessionId(event.last_tool_name)) emit({ kind: 'tool', sessionId: associated, tool: sessionId(event.last_tool_name), status: 'running' });
    }
    if (event.type === 'assistant') {
      const content = sessionObject(event.message).content;
      const blocks = (Array.isArray(content) ? content : []).map(sessionObject);
      const visible = blocks.filter(block => block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('');
      if (visible) emit({ kind: 'message', sessionId: actor, text: visible });
      for (const block of blocks) {
        if (block.type === 'tool_use' && sessionId(block.name)) {
          emit({ kind: 'tool', sessionId: actor, tool: sessionId(block.name), status: 'running' });
          const id = sessionId(block.id);
          if (block.name === 'Agent' && id && requested.size < 64) { requested.add(id); child(id, 'queued'); }
        }
      }
    }
    if (event.type === 'user') {
      const content = sessionObject(event.message).content;
      for (const value of Array.isArray(content) ? content : []) {
        const block = sessionObject(value), tool = sessionId(block.tool_use_id);
        if (block.type === 'tool_result' && tool && requested.has(tool)) child(tool, block.is_error === true ? 'failed' : 'completed');
      }
    }
    if (event.type === 'result' && !parentTool && (!root || !event.session_id || sessionId(event.session_id) === root)) {
      if (typeof event.result === 'string' && event.result.trim()) emit({ kind: 'message', sessionId: root, text: event.result });
      emit({ kind: 'session', sessionId: root, status: event.is_error === false && event.subtype === 'success' ? 'completed' : 'failed' });
    }
  };
}
