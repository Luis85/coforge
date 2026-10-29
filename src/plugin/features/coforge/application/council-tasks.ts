import type { LinkedCouncilIdea } from "../domain/council-linked-idea";
import { COUNCIL_IDEA_START, COUNCIL_IDEA_END } from "./council-linked-idea";
import {
  councilTaskInputCheck,
  type CouncilTaskMetadata,
} from "../domain/council-task";
import { resolveCouncilPlan, type CouncilTarget } from "./council-execution";
import type { CouncilCatalogueActions } from "./council-catalogue";

export interface CouncilTaskInput {
  projectId: string;
  target: CouncilTarget;
  title: string;
  question: string;
  idempotencyKey: string;
  linkedIdea?: LinkedCouncilIdea;
}
export interface CouncilTaskRecord {
  path: string;
  sourceId: string;
  projectId: string;
  target: CouncilTarget;
  title: string;
  createdAt: string;
  linkedIdea?: LinkedCouncilIdea;
}
export interface CouncilTaskNotes {
  create(
    metadata: CouncilTaskMetadata,
    question: string,
  ): Promise<CouncilTaskRecord>;
  list(): Promise<CouncilTaskRecord[]>;
}

/** Creating a source is local authoring; admission and provider execution remain separate. */
export class CouncilTasks {
  constructor(
    private readonly notes: CouncilTaskNotes,
    private readonly catalogue: CouncilCatalogueActions,
    private readonly projectReady: (id: string) => boolean,
    private readonly assertReady: () => void,
    private readonly now = () => new Date().toISOString(),
    private readonly captureIdea?: (
      link: LinkedCouncilIdea,
      projectId: string,
    ) => Promise<string>,
  ) {}
  async create(input: CouncilTaskInput): Promise<CouncilTaskRecord> {
    this.assertReady();
    const checked = councilTaskInputCheck(input);
    if (!checked.question.trim())
      throw new Error("Enter a question or task for the Council.");
    if (/<!--\s*coforge:v2:/iu.test(checked.title + "\n" + checked.question))
      throw new Error(
        "The question contains a reserved contribution marker. Remove it before saving.",
      );
    if (!this.projectReady(checked.projectId))
      throw new Error("Select an available project before saving a task.");
    const plan = resolveCouncilPlan(
      await this.catalogue.list(),
      checked.target,
    );
    if (
      plan.team.projectId !== checked.projectId ||
      plan.definition.projectId !== checked.projectId
    )
      throw new Error(
        "The selected Council and team must belong to this project.",
      );
    let question = checked.question;
    if (
      question.includes(COUNCIL_IDEA_START) ||
      question.includes(COUNCIL_IDEA_END)
    )
      throw new Error(
        "Remove reserved linked request markers from the question.",
      );
    if (checked.linkedIdea) {
      if (!this.captureIdea)
        throw new Error(
          "Linked request assessment is unavailable in this host.",
        );
      question +=
        "\n\n" +
        (await this.captureIdea(checked.linkedIdea, checked.projectId));
      if (question.length > 60000)
        throw new Error(
          "The complete request context exceeds the task allowance. Nothing was truncated.",
        );
    }
    this.assertReady();
    return this.notes.create(
      {
        schema: "council-task/v1",
        projectId: checked.projectId,
        target: checked.target,
        title: checked.title,
        createdAt: this.now(),
        idempotencyKey: checked.idempotencyKey,
        ...(checked.linkedIdea ? { linkedIdea: checked.linkedIdea } : {}),
      },
      question,
    );
  }
  list(): Promise<CouncilTaskRecord[]> {
    this.assertReady();
    return this.notes.list();
  }
}
