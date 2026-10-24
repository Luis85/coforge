/** A rejected studio request. `status` keeps the prototype's HTTP-like meaning for callers and tests. */
export class StudioError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'StudioError';
  }
}

export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
