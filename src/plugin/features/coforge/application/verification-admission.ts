import type { AppState } from '../domain/types';

export function assertVerificationSettled(state: Pick<AppState, 'ideas' | 'jobs'>, ideaId: string): void {
  if (state.jobs.some(job => job.ideaId === ideaId && job.nativeRuntime)) throw new Error('Recover the original native private runtime preparation before starting more work on this request. No provider cessation can be inferred from this retained cleanup handle.');
  if (state.jobs.some(job => job.ideaId === ideaId && job.nativeProcess?.privateRuntime)) throw new Error('Recover the original native provider private runtime cleanup before starting more work on this request. Its credentials remain quarantined.');
  if (state.jobs.some(job => job.ideaId === ideaId && job.verificationRuntime?.some(record => record.phase !== 'terminal'))) throw new Error('Recover the original verification container before starting more work on this request. Its outcome remains unknown.');
  if (state.jobs.some(job => job.ideaId === ideaId && job.nativeProcess && job.nativeProcess.phase !== 'terminated' && !job.nativeProcess.operatorAcknowledgedAt)) throw new Error('Recover or explicitly acknowledge the original native provider process before starting more work on this request. Its termination remains unconfirmed.');
}
