/** Reserved host transport roots are never repository material, even inside an unusually broad project. */
export const nativePrivateRuntimeSegment = (value: string): boolean => /^coforge-(?:(?:codex|claude-native|claude-reader|classifier|council|session-follow|native-job|herdr-(?:result|classifier|plan))-[a-z0-9]{6}|native-controller-[a-f0-9]{64}|workflow-verification)$/iu.test(value);
export const privateWorkflowSegment = (value: string): boolean => value.toLowerCase() === '.nq' || nativePrivateRuntimeSegment(value);
