import { createHash } from 'node:crypto';

/** Persist the same JavaScript path normalization for every native identity transport. */
export const nativeProcessImageHash = (path: string, platform = process.platform): string => createHash('sha256')
  .update(platform === 'win32' ? path.normalize().toLowerCase() : path).digest('hex');
