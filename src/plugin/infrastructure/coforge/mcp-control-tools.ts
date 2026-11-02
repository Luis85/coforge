const CONTROL_TOOLS: readonly string[] = [
  'coforge_request_status', 'coforge_step_context', 'coforge_command_status',
  'coforge_commands', 'coforge_cancel_step', 'coforge_cancel_command',
];

/** Existing scoped observation/cancellation calls may settle work without waiting behind new work. */
export const isMcpControlTool = (name: string): boolean => CONTROL_TOOLS.includes(name);
