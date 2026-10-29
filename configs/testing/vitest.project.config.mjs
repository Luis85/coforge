import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import { sharedConfig } from '../../tooling/bundling/vite-shared.mjs';
const shared = sharedConfig();
// Product tests. A bare `obsidian` import throws on purpose: each test file opts in to the
// in-memory host with `vi.mock('obsidian', () => import('@test/obsidian'))` (docs/framework/testing/OBSIDIAN-TEST-KIT.md).
const hostBoundary = { name: 'vitest-obsidian-boundary',
  resolveId(id) { if (id === 'obsidian') return '\0obsidian-host-boundary'; },
  load(id) { if (id === '\0obsidian-host-boundary') return 'throw new Error("OBSIDIAN_BOUNDARY_REQUIRES_EXPLICIT_TEST_DOUBLE")'; },
};
const testKit = { '@test/obsidian': fileURLToPath(new URL('../../src/plugin/tests/support/obsidian/index.ts', import.meta.url)) };
// DOM tests (views, settings, Vue components) start with `// @vitest-environment happy-dom`.
// Keep the concise local default; CI also retains exact failures beyond bounded console diagnostics.
// `npm run make` writes the tests of the features it creates to src/plugin/tests/unit/generated.
export default defineConfig({ ...shared, resolve: { ...shared.resolve, alias: { ...shared.resolve?.alias, ...testKit } }, plugins: [...shared.plugins, hostBoundary], test: {
  include: ["src/plugin/tests/project/**/*.test.{ts,mjs}", "src/plugin/tests/unit/generated/**/*.test.ts"], environment: 'node', fileParallelism: false,
  ...(process.env.CI ? { reporters: ['default', 'json'],
    outputFile: { json: fileURLToPath(new URL('../../reports/product-tests.json', import.meta.url)) } } : {}),
  // Playwright specs (npm run test:e2e) run in a browser, never in Vitest.
  exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  setupFiles: ["src/plugin/tests/project/ui-bootstrap.mjs"],
} });
