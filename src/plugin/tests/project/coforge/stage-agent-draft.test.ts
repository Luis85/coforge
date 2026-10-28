import { expect, it } from "vitest";
import {
  copyStageAgentDrafts,
  stageAgentDrafts,
  stageAgentOverrides,
  stageAgentDraftValues,
} from "../../../presentation/stores/coforge-stage-agent-draft";
it("keeps project inheritance distinct from explicit selections and isolates editable drafts", () => {
  const initial = stageAgentDrafts({
    screen: { provider: "claude", model: "sonnet" },
    implement: { provider: "demo" },
  });
  expect(stageAgentOverrides(initial)).toEqual({
    screen: { provider: "claude", model: "sonnet" },
    implement: { provider: "demo" },
  });
  const changed = copyStageAgentDrafts(initial);
  changed.screen.model = "opus";
  expect(initial.screen.model).toBe("sonnet");
  changed.screen.provider = "";
  changed.screen.model = "";
  expect(stageAgentOverrides(changed)).toEqual({
    implement: { provider: "demo" },
  });
  expect(stageAgentOverrides(stageAgentDrafts())).toEqual({});
  changed.plan.model = "--invalid-model-flag";
  expect(stageAgentDraftValues(changed).plan?.model).toBe(
    "--invalid-model-flag",
  );
  expect(() => stageAgentOverrides(changed)).toThrow();
});
