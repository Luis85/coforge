import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tooling/tests/native-process/windows-*.test.ts'], environment: 'node', fileParallelism: false,
  testTimeout: 30000, hookTimeout: 15000, reporters: ['default', 'json', 'junit'],
  outputFile: { json: 'reports/native-process/results.json', junit: 'reports/native-process/junit.xml' } } });
