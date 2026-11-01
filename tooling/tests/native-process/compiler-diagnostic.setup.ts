import processTools from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { observeCompilerFailures } from './compiler-diagnostic';

const records: unknown[] = [], directory = resolve('reports/native-process');
processTools.execFile = observeCompilerFailures(processTools.execFile, value => {
  if (records.length >= 16) return;
  records.push(value);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `compiler-${process.pid}.json`), JSON.stringify(records), { mode: 0o600 });
});
syncBuiltinESMExports();
