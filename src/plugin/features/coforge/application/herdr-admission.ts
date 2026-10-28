type Owner = 'manual' | 'workflow';

/** One private admission boundary for manual controls and automatic workflows. */
export class HerdrAdmission {
  private readonly ready: Record<Owner, boolean> = { manual: false, workflow: false };
  private readonly holds: Record<Owner, Set<string>> = { manual: new Set(), workflow: new Set() };
  private active: symbol | undefined;

  initialize(owner: Owner, unresolved: readonly string[]): void {
    this.replaceHolds(owner, unresolved);
    this.ready[owner] = true;
  }
  close(owner: Owner): void { this.ready[owner] = false; }
  replaceHolds(owner: Owner, unresolved: readonly string[]): void { this.holds[owner] = new Set(unresolved); }
  hold(owner: Owner, id: string): void { this.holds[owner].add(id); }
  assertRecovery(): void {
    if (!this.ready.manual || !this.ready.workflow)
      throw new Error('Both Herdr recovery journals must load successfully before changing or recovering an action.');
    if (this.active) throw new Error('A Herdr action is active. Wait for it to finish before acknowledging recovery.');
  }
  acquire(): () => void {
    this.assertRecovery();
    if (this.holds.manual.size || this.holds.workflow.size)
      throw new Error('A Herdr action needs attention. Inspect and acknowledge its recovery record before another mutation or configuration change.');
    const token = Symbol();
    this.active = token;
    return () => { if (this.active === token) this.active = undefined; };
  }
}
