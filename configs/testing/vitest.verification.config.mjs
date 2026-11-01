import { defineConfig } from "vitest/config";
import project from "./vitest.project.config.mjs";

/** Real Docker qualification is isolated from ordinary unit suites and never conditionally skipped. */
export default defineConfig({
  ...project,
  test: {
    ...project.test,
    name: "workflow-verification",
    include: ["tooling/tests/workflow-verification/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    retry: 0,
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 120000,
    passWithNoTests: false,
    outputFile: {
      json: "reports/workflow-verification/results.json",
      junit: "reports/workflow-verification/junit.xml",
    },
  },
});
