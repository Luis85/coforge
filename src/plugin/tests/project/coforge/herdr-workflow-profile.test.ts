import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildHerdrWorkflowArgs } from '../../../infrastructure/coforge/herdr-workflow-profile';
import type { HerdrWorkflowProfile } from '../../../features/coforge/application/herdr-workflow-ports';

const areas: string[] = [];
afterEach(async () => { await Promise.all(areas.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
async function fixture(stage: HerdrWorkflowProfile['stage'] = 'screen') {
  const cwd = await mkdtemp(join(tmpdir(), 'coforge-profile-'));
  areas.push(cwd);
  const artifact = stage === 'plan' ? await mkdtemp(join(tmpdir(), 'coforge-artifact-')) : cwd;
  if (artifact !== cwd) areas.push(artifact);
  return { cwd, profile: { name: 'cf-12345678', kind: 'claude' as const, model: 'sonnet', stage,
    resultPath: join(artifact, 'result.json'), systemPrompt: 'Trusted instructions.\nReturn the stage result.' } };
}

describe('managed Herdr Claude launch policy', () => {
  it.each(['screen', 'score'] as const)('restricts %s to writing its own result artifact', async (stage) => {
    const { cwd, profile } = await fixture(stage);
    const args = await buildHerdrWorkflowArgs(cwd, { ...profile, effort: 'high' });
    expect(args.slice(args.indexOf('--effort'), args.indexOf('--effort') + 2)).toEqual(['--effort', 'high']);
    expect(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2)).toEqual(['--model', 'sonnet']);
    expect(args[args.indexOf('--tools') + 1]).toBe('Write');
    expect(args[args.indexOf('--allowedTools') + 1]).toMatch(/^Edit\(\/\/.*result\.json\)$/u);
    expect(args[args.indexOf('--system-prompt') + 1]).toBe('Trusted instructions. Return the stage result.');
    expect(args).toContain('--restricted');
    expect(args).toContain('--safe-mode');
    expect(args).not.toContain('--print');
    expect(args).not.toContain('--max-budget-usd');
    expect(args).not.toContain('--permission-prompts');
    expect(args).not.toContain('--add-dir');
  });

  it('allows planning reads and an exact write in a separate artifact directory', async () => {
    const { cwd, profile } = await fixture('plan');
    const args = await buildHerdrWorkflowArgs(cwd, profile);
    expect(args[args.indexOf('--tools') + 1]).toBe('Read,Glob,Grep,Write');
    expect(args[args.indexOf('--allowedTools') + 1]).toMatch(/^Read,Glob,Grep,Edit\(\/\/.*result\.json\)$/u);
    expect(args[args.indexOf('--add-dir') + 1]).not.toBe(cwd);
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('dontAsk');
  });

  it('allows building edits while denying repository metadata, secrets and dependency manifests', async () => {
    const { cwd, profile } = await fixture('implement');
    const args = await buildHerdrWorkflowArgs(cwd, profile);
    expect(args[args.indexOf('--tools') + 1]).toBe('Read,Glob,Grep,Edit,Write');
    expect(args[args.indexOf('--disallowedTools') + 1]).toContain('Edit(**/.git/**)');
    expect(args[args.indexOf('--disallowedTools') + 1]).toContain('Read(**/.env*)');
    expect(args[args.indexOf('--disallowedTools') + 1]).toContain('Edit(**/package.json)');
    expect(args[args.indexOf('--disallowedTools') + 1]).not.toContain('Write(');
  });

  it('rejects models, names, artifact permissions and directories that cannot be verified safely', async () => {
    const { cwd, profile } = await fixture();
    await expect(buildHerdrWorkflowArgs(cwd, { ...profile, model: '--resume' })).rejects.toThrow();
    await expect(buildHerdrWorkflowArgs(cwd, { ...profile, sessionId: '--resume' })).rejects.toThrow();
    await expect(buildHerdrWorkflowArgs(cwd, { ...profile, name: `cf-${'a'.repeat(40)}` })).rejects.toThrow();
    await expect(buildHerdrWorkflowArgs(cwd, { ...profile, resultPath: join(cwd, 'result*.json') })).rejects.toThrow();
    await expect(buildHerdrWorkflowArgs(cwd, { ...profile, resultPath: join(cwd, '..', 'result.json') })).rejects.toThrow();
    await mkdir(join(cwd, 'nested'));
    await expect(buildHerdrWorkflowArgs(cwd, { ...profile, stage: 'plan', resultPath: join(cwd, 'nested', 'result.json') })).rejects.toThrow();
  });
});
