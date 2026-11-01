import { expect, it } from 'vitest';
import { persistProviderEvidence, validateProviderWorkspace } from '../../../infrastructure/coforge/provider-evidence';
import { ProviderFailureError, providerFailureFor, providerFailureInfo } from '../../../features/coforge/domain/provider-failure';
import { ProcessOwnershipUnknown } from '../../../infrastructure/coforge/process';
import { preserveProviderFailure } from '../../../infrastructure/coforge/provider-failure';

it('classifies a failed evidence write by the host operation, never exception prose or echoed model text', async () => {
  let failed: unknown;
  try { await persistProviderEvidence(() => { throw new Error('401 Unauthorized auth failed PRIVATE_STORAGE_CONTEXT'); }); } catch (error) { failed = error; }
  expect(providerFailureInfo(failed)?.code).toBe('persistence');
  expect(failed instanceof Error && failed.message).not.toMatch(/401|Unauthorized|PRIVATE_/u);
  await expect(validateProviderWorkspace(() => { throw new Error('/private/worktree unavailable'); })).rejects.toMatchObject({ failure: { code: 'workspace_validation' } });
});

it('keeps ownership uncertainty while recording a later mandatory storage failure instead of cancellation', () => {
  const uncertain = new ProcessOwnershipUnknown('', undefined, providerFailureFor('cancelled'));
  const failed = preserveProviderFailure(uncertain, new ProviderFailureError(providerFailureFor('persistence')));
  expect(failed).toBeInstanceOf(ProcessOwnershipUnknown); expect(providerFailureInfo(failed)?.code).toBe('persistence');
  expect(providerFailureInfo(failed)?.nextStep).toContain('confirm it has stopped');
});
