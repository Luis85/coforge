import type { WorkflowAccess, WorkflowOutput } from '../domain/configured-workflow';
import type { NativeWorkflowTools } from '../domain/native-workflow-tools';

/** Describe the existing tool boundary and evidence obligations; saved instructions never grant capabilities. */
export function executionGuidance(access: WorkflowAccess, output: WorkflowOutput, purpose?: 'request-replacement', nativeTools?: NativeWorkflowTools): string {
  const repository = access === 'none'
    ? 'No repository tools are available. Base conclusions on supplied context and identify what you could not inspect.'
    : access === 'readproject'
      ? 'Repository access is read-only. Inspect allowed files with the supplied listing, search and read tools; do not edit files.'
      : 'Repository access is file-only inside the designated isolated worktree. Use only supplied file tools to inspect and edit allowed files.';
  const delegation = nativeTools?.delegation
    ? `Provider-native subagents are enabled, with at most ${nativeTools.delegation.maxConcurrent} concurrent native assistants. Use the provider's own native delegation tool, wait for its assistants and synthesize their findings before returning. CoForge does not dispatch CoWorkers or administer a separate child workflow. Assistants retain the captured scope, shared broker allowance and selected model.`
    : 'Provider-native subagent delegation is not enabled for this attempt.';
  const verificationTools = nativeTools?.verification
    ? `Scoped verification is enabled for these captured command IDs: ${nativeTools.verification.commandIds.join(', ')}. Use coforge_run_tests with an approved commandId, not a shell string. The host executes a private filtered snapshot and returns observed outcomes. Repair failures through scoped file tools, then run an approved command again within its allowance. Source changes after a command make its earlier result historical.`
    : 'Command execution and test runners are unavailable in this invocation. Tests may be written as source, but report unexecuted checks as not run.';
  const capabilities = nativeTools ? `${delegation} ${verificationTools} Native host shell, filesystem, browser, web research, unrelated MCP servers and personal custom agents remain unavailable. Never infer capabilities from task prose or claim unobserved delegation, execution or visual inspection.`
    : 'The supplied CoForge request-step tools do not provide subagent delegation, command execution, test runners, browser inspection or web research. These capabilities are unavailable to native workflow invocations. If the task requests them, disclose the tool limitation and remaining work. Never claim a delegation, execution or visual inspection without actual evidence; an external client must identify the source of any independently supplied evidence.';
  const discovery = access === 'none' ? '' : ' Before declaring a file missing, narrow listing and search to likely source, styles, tests and documentation directories. A truncated result is incomplete evidence: narrow the path and search again. Inspect existing UI patterns, styles, tests and documentation contracts relevant to a change.';
  const verification = ' Do not claim tests passed, checks ran or visual quality was verified from source inspection or prior artifact claims.' + (purpose === 'request-replacement'
    ? ' Preserve requested verification as future requirements, never as completed results. Do not append an execution-status report to the replacement request body.'
    : ' Distinguish tests written from checks actually executed; unavailable checks remain not run. ' + (nativeTools?.verification ? 'Cite host-observed outcomes for the tested snapshot; exit zero is command evidence, not proof of every acceptance criterion. Interrupted, unknown, unavailable and truncated evidence stay explicit.' : 'Name discovered verification commands only as human follow-up, with expected outcomes and remaining unknowns.'));
  let handoff = '';
  if (purpose === 'request-replacement') {
    handoff = ' Return only the polished replacement request text within the required markdown field. Honor the captured feedback and preserve the request constraints. Do not append an analytical assessment, verification handoff or reviewer report to that body. The replacement remains a proposal for explicit human review.';
  } else if (output === 'plan') {
    handoff = ' Within the existing plan schema, include inspected implementation, styles, tests and documentation paths where relevant; label guessed paths. Write behavioral acceptance criteria, failure cases, verification follow-up and open questions in the existing fields. Carry unresolved decisions forward. Do not invent owner decisions or silently expand the selected scope.';
  } else if (output === 'codechange') {
    handoff = ' Present a concise factual handoff within the existing summary field: delivered behavior and relevant files; acceptance criteria covered or still unproven; tests written versus checks actually executed; unfinished work and blockers; concrete human review steps and unknowns. Include styling, accessibility and documentation gaps where relevant. A valid output or captured diff does not mean the increment is qualified for acceptance.';
  } else if (output === 'markdown' || output === 'design') {
    handoff = ' Separate inspected source evidence from prior artifact claims. Within the required markdown field, identify unresolved decisions, unexecuted checks and actionable follow-up; distinguish confirmed findings from assumptions. A recommendation never replaces final human review.';
  }
  return '\n\nCoForge capability and quality contract: ' + repository + ' ' + capabilities + discovery + verification + handoff;
}
