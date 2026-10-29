import { councilIdeaContextBlock } from "../../src/plugin/features/coforge/application/council-linked-idea";
import type { LinkedCouncilIdea } from "../../src/plugin/features/coforge/domain/council-linked-idea";
import {
  CouncilTasks,
  type CouncilTaskRecord,
} from "../../src/plugin/features/coforge/application/council-tasks";
import type { CouncilCatalogueActions } from "../../src/plugin/features/coforge/application/council-catalogue";
import type { CouncilSource } from "../../src/plugin/features/coforge/application/council-execution";
import type { CouncilTaskMetadata } from "../../src/plugin/features/coforge/domain/council-task";
import { COUNCIL_TASK_FOLDER } from "../../src/plugin/features/coforge/domain/council-task";
import { contextEventId } from "../../src/plugin/features/coforge/domain/integrity";

/** Browser-only authoring uses the same validation and idempotency contract without vault access. */
export function createCouncilPreviewTasks(
  catalogue: CouncilCatalogueActions,
  projectReady: (id: string) => boolean,
  put: (path: string, source: CouncilSource) => void,
  captureIdea?: (link: LinkedCouncilIdea, projectId: string) => Promise<string>,
) {
  const retained = new Map<
    string,
    {
      metadata: CouncilTaskMetadata;
      question: string;
      record: CouncilTaskRecord;
    }
  >();
  const service = new CouncilTasks(
    {
      create: async (metadata, question) => {
        const existing = retained.get(metadata.idempotencyKey);
        if (existing) {
          const expectedQuestion = metadata.linkedIdea
            ? question.replace(
                councilIdeaContextBlock(question),
                councilIdeaContextBlock(existing.question),
              )
            : question;
          if (
            existing.question !== expectedQuestion ||
            JSON.stringify({
              ...metadata,
              createdAt: existing.metadata.createdAt,
            }) !== JSON.stringify(existing.metadata)
          )
            throw new Error(
              "This example task changed. Start a new draft rather than overwriting it.",
            );
          return structuredClone(existing.record);
        }
        const sourceId = `task-${metadata.idempotencyKey}`;
        const path = `${COUNCIL_TASK_FOLDER}/${sourceId}.md`;
        const markdown = `# ${metadata.title}\n\n${question}`;
        const record: CouncilTaskRecord = {
          path,
          sourceId,
          projectId: metadata.projectId,
          target: metadata.target,
          title: metadata.title,
          createdAt: metadata.createdAt,
          ...(metadata.linkedIdea ? { linkedIdea: metadata.linkedIdea } : {}),
        };
        retained.set(metadata.idempotencyKey, {
          metadata: structuredClone(metadata),
          question,
          record,
        });
        put(path, {
          sourceId,
          generation: 0,
          revision: contextEventId(markdown.trimEnd()),
          markdown,
          ...(metadata.linkedIdea ? { linkedIdea: metadata.linkedIdea } : {}),
        });
        return structuredClone(record);
      },
      list: async () =>
        structuredClone(
          [...retained.values()].map((value) => value.record),
        ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    },
    catalogue,
    projectReady,
    () => {},
    undefined,
    captureIdea,
  );
  return {
    createTask: service.create.bind(service),
    listTasks: service.list.bind(service),
  };
}
