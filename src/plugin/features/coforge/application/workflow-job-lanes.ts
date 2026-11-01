import type { AgentJob } from '../domain/types';
import type { StudioStore } from './studio-store';
import { executionConcurrency } from '../domain/execution-concurrency';
import { DurableBuildCapacityError } from './durable-build-ports';

export const workflowJobLane = (job: AgentJob): 'build' | 'short' => job.stage === 'implement' || job.workflow?.step.access === 'editworktree' ? 'build' : 'short';
export const workerBackedJob = (job: AgentJob): boolean => job.workflow?.step.execution?.mode === 'background';
const orphanForegroundProvider = (job: AgentJob): boolean => !job.durable && !workerBackedJob(job) && ['failed', 'cancelled'].includes(job.status)
  && Boolean(job.nativeProcess && job.nativeProcess.phase !== 'terminated' && !job.nativeProcess.operatorAcknowledgedAt);
const ownsLane = (job: AgentJob): boolean => job.status === 'running' || Boolean(job.durable && !job.durable.acknowledged) || orphanForegroundProvider(job);
const ownerLane = (job: AgentJob): 'build' | 'short' => orphanForegroundProvider(job) ? 'short' : workflowJobLane(job);

/** Bounded vault-wide pools; blocked capacity never reschedules itself in a tight loop. */
export class WorkflowJobLanes {
  private closed = false;
  private readonly blocked = new Set<string>();
  private readonly capacityBlocked = new Set<string>();
  private readonly active = new Map<string, { job: AgentJob; controller: AbortController; work: Promise<void> }>();
  constructor(private readonly store: StudioStore, private readonly run: (job: AgentJob, controller: AbortController) => Promise<void>, private readonly report: (error: unknown) => void = () => {}) {}
  open(): void { this.closed = false; }
  pause(): void { this.closed = true; }
  hasActiveIdea(ideaId: string): boolean { return [...this.active.values()].some(item => item.job.ideaId === ideaId); }
  poke(): void { for (const id of this.capacityBlocked) this.blocked.delete(id); this.capacityBlocked.clear(); this.kick(); }
  kick(): void {
    if (this.closed) return;
    for (const lane of ['build', 'short'] as const) {
      const limits = executionConcurrency(this.store.integrationSnapshot());
      const limit = lane === 'build' ? limits.builds : limits.shortTasks;
      while (!this.closed) {
      const jobs = this.store.snapshot().jobs;
      const privateCleanupIdeas = new Set(jobs.filter(job => ['failed', 'cancelled'].includes(job.status) && (job.nativeRuntime || job.nativeProcess?.privateRuntime)).map(job => job.ideaId));
      const owners = new Map(jobs.filter(ownsLane).map(job => [job.id, job]));
      for (const active of this.active.values()) if (!owners.has(active.job.id)) owners.set(active.job.id, active.job);
      if ([...owners.values()].filter(job => ownerLane(job) === lane).length >= limit) break;
      const capacityHead = jobs.findIndex(job => job.status === 'queued' && workflowJobLane(job) === lane && this.capacityBlocked.has(job.id));
      const next = jobs.find((job, index) => (capacityHead < 0 || index < capacityHead) && job.status === 'queued' && !privateCleanupIdeas.has(job.ideaId) && !this.active.has(job.id) && !this.blocked.has(job.id) && workflowJobLane(job) === lane && ![...owners.values()].some(other =>
        (other.ideaId === job.ideaId || job.workflow?.workspaceId && other.workflow?.workspaceId === job.workflow.workspaceId)));
      if (!next) break;
      const controller = new AbortController();
      const work = Promise.resolve().then(() => this.run(next, controller)).catch(error => { this.blocked.add(next.id); if (error instanceof DurableBuildCapacityError) this.capacityBlocked.add(next.id); else this.report(error); }).finally(() => { this.active.delete(next.id); this.kick(); });
      this.active.set(next.id, { job: next, controller, work });
      }
    }
  }
  abort(jobId: string): boolean {
    const active = [...this.active.values()].find(item => item.job.id === jobId);
    if (!active || workerBackedJob(active.job)) return false;
    active.controller.abort(); return true;
  }
  async idle(): Promise<void> { while (this.active.size) await Promise.all([...this.active.values()].map(item => item.work)); }
  async close(): Promise<void> {
    this.closed = true;
    const foreground = [...this.active.values()].filter(item => !workerBackedJob(item.job));
    for (const item of foreground) item.controller.abort();
    await Promise.all(foreground.map(item => item.work));
  }
}
