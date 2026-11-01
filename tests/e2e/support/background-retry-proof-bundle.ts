import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

/** Compiles only test composition and actual UI; no production import/hook or installed artifact. */
export async function backgroundRetryProofBundle(): Promise<string> {
  const result = await build({ configFile: false, logLevel: 'silent', plugins: [vue()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, target: 'es2022',
      lib: { entry: resolve('tests/e2e/support/background-retry-proof-entry.ts'), name: 'BackgroundRetryProof', formats: ['iife'] },
      rolldownOptions: { output: { codeSplitting: false } },
    },
  });
  const output = (Array.isArray(result) ? result : [result]).flatMap(value => value.output);
  const chunks = output.filter(value => value.type === 'chunk');
  if (chunks.length !== 1) throw new Error('Expected one self-contained retry UI proof chunk.');
  return chunks[0]!.code;
}
