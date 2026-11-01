import { assignProviderFailure, providerFailureFor, type ProviderFailureCode } from '../../../features/coforge/domain/provider-failure';
import type { NativeWorkflowLifetimeRef } from '../../../features/coforge/domain/native-workflow-lifetime';
import type { NativeProcessIdentity } from '../durable-worker/process-identity';

export type OwnedWorktreeFailureCode = 'unsupported_platform' | 'non_admin_required' | 'controller_unavailable' | 'executable_unavailable' | 'invalid_invocation' | 'startup_failed' | 'ownership_unknown';
const messages: Record<OwnedWorktreeFailureCode, string> = {
  unsupported_platform: 'Owned native commands are not qualified on this platform. Use a supported Windows desktop; no unowned fallback was started.',
  non_admin_required: 'Native coding must run under the normal non-admin desktop account. Restart the host without elevation; no command was started.',
  controller_unavailable: 'The Windows native process controller could not be prepared. Check local runtime/file permissions; no unowned fallback was started.',
  executable_unavailable: 'The command executable is unavailable or is not a native program. Check its installed executable path and retry explicitly.',
  invalid_invocation: 'The command working directory, arguments or input are invalid. Review the task command before retrying.',
  startup_failed: 'The operating system could not start the command executable. Check executable compatibility, access and installation before retrying.',
  ownership_unknown: 'Original command lifetime remains unverified. Check the original execution before starting another command in this task.',
};
const classifications: Record<OwnedWorktreeFailureCode, ProviderFailureCode> = {
  unsupported_platform: 'native_platform', non_admin_required: 'native_elevation', controller_unavailable: 'native_controller',
  invalid_invocation: 'configuration', executable_unavailable: 'installation', startup_failed: 'installation', ownership_unknown: 'ownership_unknown',
};
/** Fixed public classification only; never contains raw process output, paths, arguments or environment. */
export class OwnedWorktreeError extends Error {
  declare readonly identity?: NativeProcessIdentity;
  declare readonly lifetime?: NativeWorkflowLifetimeRef;
  constructor(readonly code: OwnedWorktreeFailureCode, ownership?: { identity?: NativeProcessIdentity; lifetime: NativeWorkflowLifetimeRef }) {
    super(messages[code]); this.name = 'OwnedWorktreeError';
    if (ownership) {
      Object.defineProperty(this, 'identity', { value: ownership.identity, enumerable: false });
      Object.defineProperty(this, 'lifetime', { value: ownership.lifetime, enumerable: false });
    }
    assignProviderFailure(this, providerFailureFor(classifications[code], code === 'ownership_unknown'));
  }
}
