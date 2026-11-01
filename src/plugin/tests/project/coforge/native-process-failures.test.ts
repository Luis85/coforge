import { expect, it } from 'vitest';
import { OwnedWorktreeError } from '../../../infrastructure/coforge/native-process/errors';
import { providerFailureInfo, providerFailureInfoCheck, providerFailureMessage } from '../../../features/coforge/domain/provider-failure';

it.each([
  ['unsupported_platform', 'native_platform', 'Windows'],
  ['non_admin_required', 'native_elevation', 'without elevation'],
  ['controller_unavailable', 'native_controller', 'permissions'],
  ['invalid_invocation', 'configuration', 'configuration'],
  ['executable_unavailable', 'installation', 'executable'],
  ['startup_failed', 'installation', 'executable'],
  ['ownership_unknown', 'ownership_unknown', 'original execution'],
] as const)('retains the actionable %s cause through the public failure catalogue', (code, expected, action) => {
  const failure = providerFailureInfo(new OwnedWorktreeError(code));
  expect(failure?.code).toBe(expected);
  expect(failure).toBeDefined();
  if (!failure) throw new Error('Expected a fixed public failure');
  expect(providerFailureMessage(failure).toLowerCase()).toContain(action.toLowerCase());
  expect(providerFailureInfoCheck(JSON.parse(JSON.stringify(failure)))).toEqual(failure);
});
