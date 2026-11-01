import { build } from 'vite';
import { resolve } from 'node:path';
import { sharedConfig } from '../../../tooling/bundling/vite-shared.mjs';

/** Uses the shipped Vue/Nuxt UI compilation with synthetic, isolated run state. */
export async function polishingCardProofBundle(): Promise<string> {
  const config = sharedConfig();
  const result = await build({ ...config, configFile: false, logLevel: 'silent',
    build: { ...config.build, write: false, minify: false,
      lib: { entry: resolve('tests/e2e/support/polishing-card-proof-entry.ts'), name: 'PolishingCardProof', formats: ['iife'] },
      rolldownOptions: { output: { codeSplitting: false } },
    },
  });
  const chunks = (Array.isArray(result) ? result : [result]).flatMap(value => value.output).filter(value => value.type === 'chunk');
  if (chunks.length !== 1) throw new Error('Expected one self-contained polishing-card proof chunk.');
  return chunks[0]!.code;
}
