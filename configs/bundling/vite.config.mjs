import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';
import { licenseNotices } from '../../tooling/bundling/license-notices.mjs';
import { sharedConfig } from '../../tooling/bundling/vite-shared.mjs';
import { moduleAttribution } from '../../tooling/bundling/module-attribution.mjs';
export default defineConfig(() => {
  const config = sharedConfig();
  return { ...config, plugins: [...config.plugins, licenseNotices(), moduleAttribution()], build: { ...config.build, outDir: 'dist', emptyOutDir: true,
    lib: { entry: 'src/plugin/main.ts', formats: ['cjs'], fileName: () => 'main.js', cssFileName: 'styles' },
    // CoForge runs the native Claude Code CLI and Git from desktop Obsidian, so Node built-ins stay host-provided.
    rolldownOptions: { external: ['obsidian', 'electron', ...builtinModules, ...builtinModules.map(name => `node:${name}`)], output: { exports: 'default', codeSplitting: false } },
  } };
});
