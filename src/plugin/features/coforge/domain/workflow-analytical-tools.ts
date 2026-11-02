import { oneOf, shape } from './check';
import { nativeWorkflowToolsCheck, type NativeWorkflowTools } from './native-workflow-tools';

export interface AnalyticalWorkflowTools { version: 1; profile: 'scoped-analyst-v1' }
export const analyticalWorkflowToolsCheck = shape({ version: oneOf([1] as const), profile: oneOf(['scoped-analyst-v1'] as const) }, { strict: true });
interface AnalyticalStep { kind?: string; access: string; output: string; nativeTools?: NativeWorkflowTools }
export function isAnalyticalWorkflowStep(step: AnalyticalStep, provider: string): boolean {
  return step.kind === 'ai' && ['claude', 'codex'].includes(provider) && ['none', 'readproject'].includes(step.access) && ['plan', 'design', 'markdown'].includes(step.output);
}
/** Version-one defaults are applied only at new admission, never by a provider or from task prose. */
export function resolvedAnalyticalWorkflowTools(step: AnalyticalStep, provider: string): NativeWorkflowTools | undefined {
  if (!isAnalyticalWorkflowStep(step, provider)) return;
  return nativeWorkflowToolsCheck({ ...step.nativeTools, delegation: step.nativeTools?.delegation ?? { maxConcurrent: 2 }, research: step.nativeTools?.research ?? true });
}
export function admittedAnalyticalStep<T extends AnalyticalStep & { provider: string }>(step: T, capture?: AnalyticalWorkflowTools): T {
  if (!capture) return step;
  analyticalWorkflowToolsCheck(capture);
  const nativeTools = resolvedAnalyticalWorkflowTools(step, step.provider);
  if (!nativeTools) throw new Error('Scoped analytical tools require a native analytical step with no repository writes.');
  return { ...step, nativeTools };
}
