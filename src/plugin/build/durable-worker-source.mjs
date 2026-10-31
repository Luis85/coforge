import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'vite';

const virtualId = 'virtual:coforge-durable-worker-source';
const internalId = '\0' + virtualId;
const defaultEntry = 'src/plugin/infrastructure/coforge/durable-worker/entry.ts';
const builtins = new Set([...builtinModules, ...builtinModules.map(name => `node:${name}`)]);

/** The worker is embedded as inert bytes, preserving Obsidian's existing three-file installation. */
export async function compileDurableWorkerSource(root, entry = defaultEntry) {
  const result = await build({ root, configFile: false, logLevel: 'silent',
    build: { write: false, minify: false, target: 'node22', sourcemap: false,
      lib: { entry: resolve(root, entry), formats: ['cjs'], fileName: () => 'coforge-durable-worker.cjs' },
      rolldownOptions: { external: [...builtins, 'obsidian', 'electron'], output: { exports: 'named', codeSplitting: false } },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
  const chunks = outputs.filter(item => item.type === 'chunk');
  if (chunks.length !== 1 || outputs.some(item => item.type !== 'chunk')) throw new Error('Durable worker must compile to one self-contained Node module.');
  const chunk = chunks[0];
  const external = [...chunk.imports, ...chunk.dynamicImports].find(name => !builtins.has(name));
  if (external) throw new Error(`Durable worker cannot depend on host module ${external}.`);
  return { code: chunk.code, files: chunk.moduleIds.filter(id => !id.startsWith('\0')) };
}

export function durableWorkerSource() {
  let root = process.cwd();
  return { name: 'coforge-durable-worker-source',
    configResolved(config) { root = config.root; },
    resolveId(id) { if (id === virtualId) return internalId; },
    async load(id) {
      if (id !== internalId) return;
      const compiled = await compileDurableWorkerSource(root);
      for (const file of compiled.files) this.addWatchFile(file);
      return `export default ${JSON.stringify(compiled.code)};`;
    },
  };
}
