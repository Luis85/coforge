import type { ExecutionAdmission } from '../domain/execution-run';
import { automationContextCheck, type AutomationContext } from '../domain/automation-context';
import { record } from '../domain/check';
/** Host provenance is separate from authored definitions and cannot grant tools or approve code. */
export function attachAutomationEvent(admission: ExecutionAdmission, event?: AutomationContext, maxCharacters = 160000): ExecutionAdmission {
  if (!event) return admission;
  const checked = automationContextCheck(event);
  const context = JSON.stringify({ ...record(JSON.parse(admission.context)), workflowTrigger: checked });
  if (context.length + admission.subject.markdown.length > maxCharacters) throw new Error('Workflow trigger context exceeds the complete input allowance. Nothing was truncated.');
  return { ...admission, context, automationEvent: checked };
}
