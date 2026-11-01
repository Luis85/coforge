import { expect, it } from 'vitest';
import { McpCommandOutput, mcpCommandEnvironment } from '../../../infrastructure/coforge/mcp-command-output';

it('keeps wrapped credentials private across interleaved stdout/stderr and excludes SDK secrets from command environments', () => {
  const output = new McpCommandOutput([]);
  output.append(Buffer.from('Authorization: Bearer \n'), 'stdout');
  output.append(Buffer.from('normal stderr message\n'), 'stderr');
  output.append(Buffer.from('PRIVATE_STDOUT_TOKEN\n'), 'stdout'); output.finish();
  expect(output.snapshot().output).toContain('normal stderr message');
  expect(output.snapshot().output).not.toContain('PRIVATE_STDOUT_TOKEN');
  expect(mcpCommandEnvironment({ PATH: 'tools', OPENAI_API_KEY: 'private', CODEX_HOME: 'private', ANTHROPIC_API_KEY: 'private', NODE_OPTIONS: 'private' })).toEqual({ PATH: 'tools' });
});
it('bounds a healthy verbose command without retaining a partial raw secret or broken surrogate', () => {
  const output = new McpCommandOutput([]);
  for (let index = 0; index < 100; index++) output.append(Buffer.from('界'.repeat(1500) + '\n'), 'stdout');
  output.append(Buffer.from('final diagnostic line\n'), 'stderr'); output.finish();
  expect(output.snapshot().output.length).toBeLessThanOrEqual(64000);
  expect(output.snapshot().truncated).toBe(true);
  expect(output.snapshot().output).toContain('final diagnostic line');
});
