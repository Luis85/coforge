import { expect, it } from "vitest";
import { configurationProblem } from "../../../presentation/stores/configuration-guard";
it("protects every configuration draft for navigation and project switches without blocking its own editor", () => {
  const dirty = {
    settings: false,
    "community-settings": false,
    "workflow-settings": true,
  };
  expect(configurationProblem(dirty, "workflow-settings")).toBe("");
  expect(configurationProblem(dirty, "board")).toContain("workflow settings");
  expect(configurationProblem(dirty)).toContain("switching projects");
  expect(
    configurationProblem({ ...dirty, "workflow-settings": false }, "board"),
  ).toBe("");
  expect(
    configurationProblem({
      ...dirty,
      "workflow-settings": false,
      "community-settings": true,
    }),
  ).toContain("community settings");
});
