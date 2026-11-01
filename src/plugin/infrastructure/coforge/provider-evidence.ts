import { assignProviderFailure, ProviderFailureError, providerFailureFor, providerFailureMessage } from '../../features/coforge/domain/provider-failure';
import { ProcessOwnershipUnknown } from './process';

/** Classifies the failed host operation, never its exception prose, paths, model content or storage details. */
async function hostOperation<T>(code: 'persistence' | 'workspace_validation', work: () => T | Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    const info = providerFailureFor(code, error instanceof ProcessOwnershipUnknown);
    if (error instanceof ProcessOwnershipUnknown) { assignProviderFailure(error, info); error.message = providerFailureMessage(info, true); throw error; }
    throw new ProviderFailureError(info);
  }
}
export const persistProviderEvidence = <T>(work: () => T | Promise<T>): Promise<T> => hostOperation('persistence', work);
export const validateProviderWorkspace = <T>(work: () => T | Promise<T>): Promise<T> => hostOperation('workspace_validation', work);
