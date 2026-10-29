import { expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import type { AgentTaskRequest } from '../../../features/coforge/application/agent-task';
import type { StageInput } from '../../../features/coforge/application/ports';
import { workflowRunCheck } from '../../../features/coforge/domain/configured-workflow-run';
import type { CouncilWorkflowStep } from '../../../features/coforge/domain/configured-workflow';
import type { WorkflowOutputTemplate } from '../../../features/coforge/domain/workflow-output-templates';
import { createSeed } from '../../../features/coforge/domain/seed';
import { workflowEditorIssues } from '../../../presentation/composables/coforge/workflow-editor-validation';
import { ai, definition } from './configured-workflow-fixture';
import { MemoryStorage, nodeTimers } from './memory-storage';
import { testCouncilBinding } from './workflow-council-test-binding';

const council: CouncilWorkflowStep = { id: 'advice', kind: 'council', name: 'Ask Council', councilId: 'advice', instructions: 'Compare the options.', contextMode: 'none', automatic: false };

it('recognizes Council Markdown as an earlier producer in the merged validation summary', () => {
  const workflow = definition([council, { ...ai('use-advice'), inputs: ['markdown'] }]);
  expect(workflowEditorIssues(workflow)).toEqual([]);
});

it('captures Council bindings and AI templates together, waits for advice and keeps both snapshots after template deletion', async () => {
  const seed = createSeed(); seed.settings.paused = true;
  seed.settings.workflow = definition([council, { ...ai('use-advice'), automatic: false, inputs: ['markdown'], outputTemplateId: 'answer-template' }]);
  const storage = new MemoryStorage(seed);
  const original: WorkflowOutputTemplate = { id: 'answer-template', projectId: 'CFP-001', name: 'Original outline', markdown: '# Captured answer\n\n## Evidence', revision: 'template-original' };
  let live: WorkflowOutputTemplate | undefined = original; let complete = false;
  const admissions: AgentTaskRequest[] = []; const dispatched: StageInput[] = [];
  const list = vi.fn(async () => ({ templates: live ? [live] : [], invalid: [] }));
  const studio = new StudioService(storage, { timers: nodeTimers(), probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }),
    outputTemplates: { list, save: async () => { throw new Error('No template writes'); }, remove: async () => {}, open: async () => {} },
    runners: { demo: async input => { dispatched.push(input); return { markdown: '# Captured answer\n\nAn answer using the Council evidence.' }; }, claude: async () => ({}) },
    agentTasks: { prepareCouncil: async (projectId, councilId) => testCouncilBinding(projectId, councilId), create: async input => { admissions.push(input); return { runId: 'child-advice', sourcePath: input.sourcePath, sourceId: 'child-source' }; }, result: async () => complete ? { state: 'completed', projectId: 'CFP-001', sourcePath: admissions[0]!.sourcePath, sourceId: 'child-source', markdown: 'Published Council advice.' } : { state: 'pending' }, cancel: async () => {} },
  });
  await studio.start();
  try {
    const id = studio.state().ideas.find(idea => idea.status === 'inbox')!.id;
    const run = await studio.startWorkflow(id);
    expect(workflowRunCheck(run)).toMatchObject({ state: 'running', cursor: 0, outputTemplates: [original], councilBindings: [{ stepId: 'advice', binding: testCouncilBinding() }] });
    expect(dispatched).toHaveLength(0); expect(admissions).toHaveLength(1);
    live = undefined; complete = true;
    await studio.runWorkflowStep(id); await studio.runWorkflowStep(id);
    await vi.waitFor(() => expect(studio.state().ideas.find(idea => idea.id === id)?.workflowRun?.state).toBe('finished'));
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]?.workflow).toMatchObject({ outputTemplate: original, inputArtifacts: [expect.objectContaining({ markdown: 'Published Council advice.' })] });
    expect(list).toHaveBeenCalledTimes(1); expect(admissions).toHaveLength(1);
    const reloaded = new StudioStore(storage); await reloaded.init();
    expect(reloaded.snapshot().ideas.find(idea => idea.id === id)?.workflowRun).toMatchObject({ outputTemplates: [original], councilBindings: run.councilBindings });
  } finally { await studio.stop(); }
});
