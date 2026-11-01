import { describe, expect, it } from 'vitest';
import { captureWorkflowVerification, nativeWorkflowToolsCheck, validateNativeWorkflowTools, workflowVerificationProfileCheck } from '../../../features/coforge/domain/native-workflow-tools';
import { workflowVerificationRecordCheck } from '../../../features/coforge/domain/workflow-verification';

const imageId = `sha256:${'a'.repeat(64)}`;
const profile = { enabled: true, dockerBin: 'docker', imageId, timeoutSeconds: 600, maxRuns: 8,
  commands: [{ id: 'test', label: 'Product tests', executable: 'npm', args: ['run', 'test'] }, { id: 'types', label: 'Typecheck', executable: 'npm', args: ['run', 'typecheck'] }] };

describe('captured native workflow capabilities', () => {
  it('rejects empty, unknown, duplicate and unbounded capability grants', () => {
    expect(() => nativeWorkflowToolsCheck({})).toThrow();
    expect(() => nativeWorkflowToolsCheck({ shell: true })).toThrow();
    expect(() => nativeWorkflowToolsCheck({ delegation: { maxConcurrent: 9 } })).toThrow();
    expect(() => nativeWorkflowToolsCheck({ verification: { commandIds: ['test', 'test'] } })).toThrow();
    expect(() => workflowVerificationProfileCheck({ ...profile, imageId: 'node:latest' })).toThrow();
    expect(() => workflowVerificationProfileCheck({ ...profile, commands: [...profile.commands, profile.commands[0]] })).toThrow();
  });

  it('allows bounded native analysis without repository access but keeps verification scoped', () => {
    const nativeTools = { delegation: { maxConcurrent: 2 } };
    expect(() => validateNativeWorkflowTools({ provider: 'claude', access: 'none', nativeTools })).not.toThrow();
    expect(() => validateNativeWorkflowTools({ provider: 'herdr', access: 'readproject', nativeTools })).toThrow();
    expect(() => validateNativeWorkflowTools({ provider: 'codex', access: 'editworktree', nativeTools, execution: { mode: 'background' } })).toThrow();
    expect(() => validateNativeWorkflowTools({ provider: 'codex', access: 'editworktree', nativeTools, execution: { mode: 'background', maxRuntimeSeconds: 600 } })).not.toThrow();
    expect(() => captureWorkflowVerification({ verification: { commandIds: ['test'] } }, profile, 'none')).toThrow();
  });

  it('captures only explicitly requested commands from the independent host grant', () => {
    expect(captureWorkflowVerification(undefined, profile, 'readproject')).toBeUndefined();
    expect(() => captureWorkflowVerification({ verification: { commandIds: ['test'] } }, undefined, 'readproject')).toThrow();
    expect(() => captureWorkflowVerification({ verification: { commandIds: ['test'] } }, { ...profile, enabled: false }, 'readproject')).toThrow();
    expect(() => captureWorkflowVerification({ verification: { commandIds: ['missing'] } }, profile, 'editworktree')).toThrow();
    const captured = captureWorkflowVerification({ verification: { commandIds: ['types'] } }, profile, 'editworktree');
    expect(captured?.commands.map(command => command.id)).toEqual(['types']);
    profile.commands[1]!.args.push('--changed-later');
    expect(captured?.commands[0]?.args).toEqual(['run', 'typecheck']);
    profile.commands[1]!.args.pop();
  });

  it('requires observed exit evidence for terminal command outcomes and keeps interruptions distinct', () => {
    const record = { id: 'verification-1', runId: 'run', attemptId: 'attempt', projectId: 'CFP-001', commandId: 'test', label: 'Tests', executable: 'npm', args: ['test'], runtime: 'docker', imageId,
      sourceHash: 'b'.repeat(64), startedAt: '2026-11-01T08:00:00Z', output: '', truncated: false };
    expect(() => workflowVerificationRecordCheck({ ...record, status: 'completed' })).toThrow();
    expect(() => workflowVerificationRecordCheck({ ...record, status: 'completed', finishedAt: '2026-11-01T08:01:00Z', exitCode: 1 })).toThrow();
    expect(workflowVerificationRecordCheck({ ...record, status: 'completed', finishedAt: '2026-11-01T08:01:00Z', exitCode: 0 }).status).toBe('completed');
    expect(workflowVerificationRecordCheck({ ...record, status: 'unknown', finishedAt: '2026-11-01T08:01:00Z' }).status).toBe('unknown');
  });
});
