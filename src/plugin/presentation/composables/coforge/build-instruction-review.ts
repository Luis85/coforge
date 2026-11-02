import { hasLegacyBuildInstructions } from '../../../features/coforge/domain/stage-prompts';

/** A trusted-instruction review hint only; never a permission grant or rewrite rule. */
export function needsBuildInstructionReview(value: string): boolean {
  return hasLegacyBuildInstructions(value) || value.includes('Do not execute commands or install dependencies.') || value.includes('marks tests as not run');
}
