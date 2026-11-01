/** Renderer-owned operations may finish private I/O after detach, but cannot revive canonical writes. */
export class HostOperationLifetime {
  private generation = 0;
  private active = true;
  open(): void { this.active = true; }
  close(): void { this.active = false; this.generation++; }
  capture(): () => void {
    const generation = this.generation;
    const assertActive = () => {
      if (!this.active || generation !== this.generation) throw new Error('This host operation is no longer active. Its saved intent and private receipt remain available for explicit review in the current host.');
    };
    assertActive(); return assertActive;
  }
}
