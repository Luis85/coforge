import type { ExecutionRun } from '../domain/execution-run';

/** Retiring execution evidence is contingent on a durable analytics copy. */
export class CouncilCostArchive {
  private archive?: () => Promise<void>;
  configure(archive: () => Promise<void>): void { this.archive = archive; }
  async beforePrune(run: Pick<ExecutionRun, 'attempts'> | undefined): Promise<void> {
    if (!run) throw new Error('The run is unavailable.');
    if (run.attempts.length && !this.archive)
      throw new Error('AI cost archiving is unavailable. Retain this run until its cost history can be saved.');
    await this.archive?.();
  }
}
