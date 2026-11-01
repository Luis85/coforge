import { oneOf, shape } from '../../../features/coforge/domain/check';
import { agentSessionTraceCheck, type AgentSessionTrace } from '../../../features/coforge/domain/agent-session';
import { durableBuildRefCheck, sameDurableBuildRef, type DurableBuildRef } from '../../../features/coforge/domain/durable-build';
import type { WorkerFiles } from './files';

const file = 'session-trace.json';
const journal = shape({ version: oneOf([1] as const), ref: durableBuildRefCheck, trace: agentSessionTraceCheck }, { strict: true });

/** Optional display evidence cannot decide whether the original control journal is available. */
export async function readWorkerSession(files: WorkerFiles, ref: DurableBuildRef, legacy?: AgentSessionTrace): Promise<AgentSessionTrace | undefined> {
  try {
    const raw = await files.read(file, 512 * 1024);
    if (raw === undefined) return legacy;
    const checked = journal(raw);
    return sameDurableBuildRef(checked.ref, ref) ? checked.trace : legacy;
  } catch { return legacy; }
}

export async function writeWorkerSession(files: WorkerFiles, ref: DurableBuildRef, trace: AgentSessionTrace): Promise<AgentSessionTrace> {
  const checked = journal({ version: 1, ref, trace });
  await files.write(file, checked);
  return checked.trace;
}
