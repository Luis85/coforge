/** Reserved host transport roots are never repository material, even inside an unusually broad project. */
export const nativePrivateRuntimeSegment = (value: string): boolean => /^coforge-(?:(?:codex|claude-native|claude-reader|classifier|council|herdr-(?:result|classifier|plan))-[a-z0-9]{6}|workflow-verification)$/iu.test(value);
export const privateWorkflowSegment = (value: string): boolean => value.toLowerCase() === '.nq' || nativePrivateRuntimeSegment(value);
