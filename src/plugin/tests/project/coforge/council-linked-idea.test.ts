import { ideaProjectId } from "../../../features/coforge/domain/projects";
import { expect, it } from "vitest";
import { createSeed } from "../../../features/coforge/domain/seed";
import { ideaFingerprint } from "../../../features/coforge/domain/integrity";
import {
  captureCouncilIdea,
  councilIdeaRevision,
} from "../../../features/coforge/application/council-linked-idea";

it("captures screened canonical item values, including its own class snapshot, without granting workflow authority", () => {
  const state = createSeed();
  const idea = state.ideas.find((item) => item.status === "shipped")!;
  idea.requestObject = {
    className: "Business Idea",
    fields: [{ key: "value", label: "Value", type: "number" }],
    values: { value: 42 },
  };
  const captured = captureCouncilIdea(
    idea,
    ideaFingerprint(idea),
    ideaProjectId(idea),
    councilIdeaRevision(idea),
  );
  expect(captured.context).toContain('"className": "Business Idea"');
  expect(captured.context).toContain('"value": 42');
  expect(captured.context).toContain("Read-only assessment");
  expect(captured.linkedIdea).toEqual({
    ideaId: idea.id,
    revision: councilIdeaRevision(idea),
  });
});

it("rejects unscreened, flagged, archived, changed and untrusted items before any task or provider work", () => {
  const idea = createSeed().ideas.find((item) => item.status === "shipped")!;
  const projectId = ideaProjectId(idea);
  const revision = councilIdeaRevision(idea);
  for (const status of ["inbox", "flagged", "rejected"] as const) {
    const changed = { ...idea, status };
    expect(() =>
      captureCouncilIdea(
        changed,
        ideaFingerprint(changed),
        projectId,
        councilIdeaRevision(changed),
      ),
    ).toThrow(/screen|archived/i);
  }
  expect(() =>
    captureCouncilIdea(idea, "not-trusted", projectId, revision),
  ).toThrow(/screen/i);
  expect(() =>
    captureCouncilIdea(
      { ...idea, title: "Changed" },
      ideaFingerprint({ ...idea, title: "Changed" }),
      projectId,
      revision,
    ),
  ).toThrow(/changed/i);
});

it("allows new votes while invalidating captured custom fields and includes no voter IDs or runtime paths", () => {
  const idea = createSeed().ideas.find((item) => item.status === "shipped")!;
  idea.requestObject = {
    className: "Business Idea",
    fields: [{ key: "value", label: "Value", type: "number" }],
    values: { value: 42 },
  };
  const before = councilIdeaRevision(idea);
  const capture = captureCouncilIdea(
    idea,
    ideaFingerprint(idea),
    ideaProjectId(idea),
    before,
  );
  idea.voters.push("private-twitch-user-id");
  idea.updatedAt = new Date().toISOString();
  expect(councilIdeaRevision(idea)).toBe(before);
  expect(() =>
    captureCouncilIdea(
      idea,
      ideaFingerprint(idea),
      ideaProjectId(idea),
      before,
    ),
  ).not.toThrow();
  expect(capture.context).not.toContain("private-twitch-user-id");
  expect(capture.context).not.toContain('"diff"');
  idea.requestObject.values.value = 43;
  expect(() =>
    captureCouncilIdea(
      idea,
      ideaFingerprint(idea),
      ideaProjectId(idea),
      before,
    ),
  ).toThrow(/changed/i);
});
