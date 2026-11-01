import type { WorktreeCodingCapability } from '../../../features/coforge/domain/worktree-coding';

export const WORKTREE_PERMISSION_HELP = 'A worktree separates Git changes; it is not an operating-system sandbox. Execution uses supported permissions under your current desktop account. CoForge requests no administrator elevation or bypass-permissions mode.';
export const NATIVE_CODING_HELP = 'The provider can use its normal file tools, shell, project tests and native assistants in this attempt’s worktree. Internet research is allowed through available provider web tools and network-enabled shell commands; provider and network restrictions still apply.';
export const MCP_RESEARCH_HELP = 'Internet research is allowed through project commands using normal desktop connectivity; the client controls its own web tools.';
export const MCP_CODING_HELP = `The external MCP client can use CoForge’s coding tools and project commands in this task’s owned worktree. ${MCP_RESEARCH_HELP} The client directs its own agents; CoForge does not dispatch native SDK children for it.`;
export const PROVIDER_TOOL_EVIDENCE_HELP = 'Provider-observed tool turns are not a passing test result or proof that the current source was tested. Read the captured command, output and exit or source evidence where available.';
export const MCP_COMMAND_EVIDENCE_HELP = 'Host-observed MCP command events retain the captured execution outcomes. Exit zero establishes process completion, not a test verdict or proof that the source is unchanged.';

export function codingProfileDisplay(profile: WorktreeCodingCapability) {
  return { profile: profile.profile, title: profile.profile === 'native-worktree-v1' ? 'Native worktree coding' : 'MCP worktree coding',
    help: profile.profile === 'native-worktree-v1' ? NATIVE_CODING_HELP : MCP_CODING_HELP,
    assistants: profile.profile === 'native-worktree-v1' ? `Up to ${profile.maxConcurrent} concurrent native assistants permitted; this does not establish that assistants ran.` : '',
    boundary: WORKTREE_PERMISSION_HELP };
}
