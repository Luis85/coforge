import { expect, it } from 'vitest';
import { childEnvironment } from '../../../infrastructure/coforge/process';

it('retains the documented Windows Git Bash selection without inheriting arbitrary host configuration or secrets', () => {
  const source = { PATH: 'fixture-path', CLAUDE_CODE_GIT_BASH_PATH: 'D:\\Portable Git\\bin\\bash.exe',
    UNRELATED_SECRET: 'fixture-private-secret', NODE_OPTIONS: '--require untrusted.cjs', ELECTRON_RUN_AS_NODE: '1', CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS: '1' };
  expect(childEnvironment(source)).toEqual({ PATH: source.PATH, CLAUDE_CODE_GIT_BASH_PATH: source.CLAUDE_CODE_GIT_BASH_PATH });
});
