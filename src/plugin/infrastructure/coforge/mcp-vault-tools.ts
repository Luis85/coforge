import type { StudioService } from '../../features/coforge/application/studio';
import { record, shape, text } from '../../features/coforge/domain/check';
import type { McpDispatcher, McpTool } from './mcp-server';
import type { McpWorkflowTools } from './mcp-workflow-tools';

const projectId = { type: 'string', pattern: '^CFP-[0-9]+$', minLength: 1, maxLength: 100 };
/** A single vault connection routes every operation by an explicit project ID, never by the selected board. */
export class McpVaultTools implements McpDispatcher {
  constructor(private readonly studio: StudioService, private readonly workflow: McpWorkflowTools, private readonly authorize: () => void = () => {}) {}
  tools(): McpTool[] {
    this.authorize();
    return [{ name: 'coforge_projects', description: 'Discover all CoForge projects in this vault. Choose a projectId explicitly for subsequent tools; changing the selected studio board never reroutes a task.',
      inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    ...this.workflow.tools().map(tool => {
      const input = record(tool.inputSchema);
      const required = input.required;
      if (!Array.isArray(required) || !required.every(value => typeof value === 'string')) throw new Error('Invalid tool schema');
      return { ...tool, inputSchema: { ...input, properties: { projectId, ...record(input.properties) }, required: ['projectId', ...required] } };
    })];
  }
  async call(name: string, raw: unknown): Promise<unknown> {
    this.authorize();
    if (name === 'coforge_projects') {
      shape({}, { strict: true })(raw);
      return { projects: (this.studio.state().projects ?? []).map(project => ({ projectId: project.id, name: project.settings.projectName,
        available: !project.unavailable, repositoryConfigured: !!project.projectPath, allowImplementation: project.allowImplementation })) };
    }
    const args = record(raw);
    const id = text({ min: 1, max: 100, pattern: /^CFP-\d+$/u })(args.projectId);
    const input = Object.fromEntries(Object.entries(args).filter(([key]) => key !== 'projectId'));
    return this.workflow.call(id, name, input);
  }
}
