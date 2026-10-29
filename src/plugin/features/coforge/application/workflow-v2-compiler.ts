import {
  agentDefinitionCheck,
  definitionRevision,
  teamDefinitionCheck,
  type AgentDefinition,
  type CouncilDefinition,
  type TeamDefinition,
} from "../domain/council-definitions";
import { compileCouncil, type CouncilPlan } from "../domain/council-protocol";
import {
  executionSubjectCheck,
  type ExecutionArtifact,
  type ExecutionCheckpoint,
  type ExecutionInvocation,
  type ExecutionSubject,
} from "../domain/execution-run";
import {
  workflowV2BindingProducers,
  workflowV2DefinitionCheck,
  type WorkflowV2Binding,
  type WorkflowV2Definition,
} from "../domain/configured-workflow-v2";
import type { ExecutionLocalAction } from "../domain/execution-local-action";
import { outputTemplateGuidance, workflowOutputTemplateListCheck, type WorkflowOutputTemplate } from '../domain/workflow-output-templates';

export interface WorkflowV2Catalogue {
  outputTemplates?: WorkflowOutputTemplate[];
  projectId: string;
  team: TeamDefinition;
  agents: AgentDefinition[];
  councils: CouncilDefinition[];
}
export interface WorkflowV2Plan {
  definition: WorkflowV2Definition;
  subject: ExecutionSubject;
  catalogue: WorkflowV2Catalogue;
  invocations: ExecutionInvocation[];
  checkpoints: ExecutionCheckpoint[];
  producerInvocationIds: Record<string, string[]>;
  invocationBindings: Record<string, WorkflowV2Binding[]>;
  councils: { stepId: string; prefix: string; plan: CouncilPlan }[];
  localActions: ExecutionLocalAction[];
}
/** Expands reusable definitions into the same host-owned lane; it never creates a worker or grants tools. */
export function compileWorkflowV2(
  value: WorkflowV2Definition,
  source: ExecutionSubject,
  catalogue: WorkflowV2Catalogue,
): WorkflowV2Plan {
  const definition = workflowV2DefinitionCheck(value);
  const subject = executionSubjectCheck(source);
  const team = teamDefinitionCheck(catalogue.team);
  if (subject.kind !== definition.subjectMode)
    throw new Error(
      "The workflow subject mode does not match the supplied note/Idea subject.",
    );
  if (
    !team.enabled ||
    team.id !== definition.teamId ||
    team.projectId !== catalogue.projectId
  )
    throw new Error("Workflow team/project scope does not match its owner.");
  if (
    new Set(catalogue.agents.map((agent) => agent.id)).size !==
      catalogue.agents.length ||
    new Set(catalogue.councils.map((council) => council.id)).size !==
      catalogue.councils.length
  )
    throw new Error(
      "Duplicate reusable definitions block workflow compilation.",
    );
  const agents = catalogue.agents.map(agentDefinitionCheck);
  const templates = workflowOutputTemplateListCheck(catalogue.outputTemplates ?? []);
  const selected = new Set(definition.steps.flatMap(step => (step.kind === 'agent' || step.kind === 'council') && step.outputTemplateId ? [step.outputTemplateId] : []));
  if (templates.length !== selected.size || templates.some(template => template.projectId !== catalogue.projectId || !selected.has(template.id)) || [...selected].some(id => templates.filter(template => template.id === id).length !== 1)) throw new Error('The workflow output template is missing, duplicated or belongs to another project. Refresh and replace or clear its selection.');
  const plan: WorkflowV2Plan = {
    definition,
    subject,
    catalogue: structuredClone({ ...catalogue, team, agents }),
    invocations: [],
    checkpoints: [],
    producerInvocationIds: {},
    invocationBindings: {},
    councils: [],
    localActions: [],
  };
  for (const [order, step] of definition.steps.entries()) {
    if (step.kind === "approval" || step.kind === "checklist") {
      plan.checkpoints.push({
        id: step.id,
        name: step.name,
        instructions: step.instructions,
        beforeCursor: plan.invocations.length,
        kind: step.kind,
        items: step.kind === "checklist" ? structuredClone(step.items) : [],
        order,
      });
      continue;
    }
    if (step.kind === "message") {
      plan.localActions.push({
        id: step.id,
        name: step.name,
        kind: "message",
        beforeCursor: plan.invocations.length,
        order,
        instructions: step.instructions,
        purpose: step.purpose,
        recipientId: step.recipientId,
        body: step.body,
        inputInvocationIds: step.inputs.flatMap((binding) =>
          workflowV2BindingProducers(definition, binding).flatMap(
            (producer) => plan.producerInvocationIds[producer] ?? [],
          ),
        ),
      });
      plan.invocationBindings[step.id] = structuredClone(step.inputs);
      continue;
    }
    const invocationIds: string[] = [];
    if (step.kind === "agent") {
      const agent = agents.find((item) => item.id === step.agentId);
      if (!agent?.enabled || !team.members.includes(agent.id))
        throw new Error(
          "The selected agent must be enabled and belong to the workflow team.",
        );
      const invocation: ExecutionInvocation = {
        id: step.id,
        roundId: step.id,
        agentId: agent.id,
        agentRevision: definitionRevision(agent),
        provider: agent.provider,
        model: agent.model,
        instructions: `${agent.role}\n\n${agent.instructions}\n\n${step.instructions}${outputTemplateGuidance(templates.find(template => template.id === step.outputTemplateId))}`,
        access: "none",
        inputRoundIds: [],
        output: step.output,
      };
      plan.invocations.push(invocation);
      invocationIds.push(invocation.id);
      plan.invocationBindings[invocation.id] = structuredClone(step.inputs);
    } else {
      const council = catalogue.councils.find(
        (item) => item.id === step.councilId,
      );
      if (!council) throw new Error("The selected council is unavailable.");
      const compiled = compileCouncil(council, team, agents);
      const prefix = `${step.id}--`;
      plan.councils.push({ stepId: step.id, prefix, plan: compiled });
      for (const item of compiled.invocations) {
        const invocation: ExecutionInvocation = {
          id: `${prefix}${item.id}`,
          roundId: `${prefix}${item.roundId}`,
          ...(item.promptOrder === undefined
            ? {}
            : { promptOrder: item.promptOrder }),
          agentId: item.agent.id,
          agentRevision: item.agentRevision,
          provider: item.agent.provider,
          model: item.agent.model,
          instructions: `${item.agent.role}\n\n${item.agent.instructions}\n\n${step.instructions}\n\n${item.instructions}${outputTemplateGuidance(templates.find(template => template.id === step.outputTemplateId))}`,
          access: "none",
          inputRoundIds: item.inputs.map((round) => `${prefix}${round}`),
          output: item.output,
          maxArtifactCharacters:
            compiled.definition.limits.maxArtifactCharacters,
          executionScope: {
            id: step.id,
            limitMs: compiled.definition.limits.maxExecutionSeconds * 1000,
          },
        };
        plan.invocations.push(invocation);
        invocationIds.push(invocation.id);
        plan.invocationBindings[invocation.id] = structuredClone(step.inputs);
      }
    }
    plan.producerInvocationIds[step.id] = invocationIds;
  }
  if (plan.invocations.length > definition.limits.maxInvocations)
    throw new Error("Expanded workflow exceeds its invocation limit.");
  if (
    plan.invocations.some(
      (item) => !item.instructions.trim() || item.instructions.length > 16000,
    )
  )
    throw new Error(
      "The assembled agent and step instructions exceed the immutable invocation allowance. Reduce authored prompts before dispatch.",
    );
  return structuredClone(plan);
}
function completeProducer(
  plan: WorkflowV2Plan,
  producer: string,
  artifacts: readonly ExecutionArtifact[],
): ExecutionArtifact[] {
  const ids = plan.producerInvocationIds[producer];
  if (!ids) throw new Error("The selected input producer is unavailable.");
  return ids.map((id) => {
    const matching = artifacts.filter(
      (artifact) => artifact.invocationId === id,
    );
    if (matching.length !== 1)
      throw new Error(
        "The producer collection is incomplete or contains conflicting contributions.",
      );
    return matching[0]!;
  });
}
/** Explicit ordered collections replace v1 latest-per-type selection only for this v2 definition. */
export function resolveWorkflowV2Inputs(
  plan: WorkflowV2Plan,
  invocationId: string,
  artifacts: readonly ExecutionArtifact[],
): ExecutionArtifact[] {
  const invocation = plan.invocations.find((item) => item.id === invocationId);
  if (
    !invocation &&
    !plan.localActions.some((item) => item.id === invocationId)
  )
    throw new Error("Workflow invocation is unavailable.");
  const result: ExecutionArtifact[] = [];
  for (const binding of plan.invocationBindings[invocationId] ?? []) {
    const producers = workflowV2BindingProducers(plan.definition, binding);
    const selected = producers.flatMap((producer) =>
      completeProducer(plan, producer, artifacts),
    );
    if (binding.kind === "artifact") {
      const exact = selected.find(
        (artifact) => artifact.id === binding.artifactId,
      );
      if (!exact)
        throw new Error("The explicitly bound artifact is unavailable.");
      result.push(exact);
    } else result.push(...selected);
  }
  for (const roundId of invocation?.inputRoundIds ?? []) {
    const producers = plan.invocations.filter(
      (item) => item.roundId === roundId,
    );
    for (const producer of producers) {
      const matching = artifacts.filter(
        (artifact) => artifact.invocationId === producer.id,
      );
      if (matching.length !== 1)
        throw new Error("The preceding council round is incomplete.");
      result.push(matching[0]!);
    }
  }
  return structuredClone(
    result.filter(
      (item, index) =>
        result.findIndex((other) => other.id === item.id) === index,
    ),
  );
}
