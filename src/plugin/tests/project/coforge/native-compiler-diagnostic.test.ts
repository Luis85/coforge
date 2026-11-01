import { afterEach, expect, it, vi } from 'vitest';
import { observeCompilerFailures } from '../../../../../tooling/tests/native-process/compiler-diagnostic';

afterEach(() => vi.unstubAllEnvs());
const compiler = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const arguments_ = ['/nologo', '/out:C:\\private\\Controller.exe', 'C:\\private\\Controller.cs'];
type Callback = (error: Error | null, stdout: string, stderr: string) => void;

it('observes only bounded scrubbed compiler failure metadata while preserving invocation, result and callback exactly', () => {
  vi.stubEnv('API_KEY', 'PRIVATE_COMPILER_CANARY');
  const error = Object.assign(new Error('RAW_PRIVATE_CAUSE'), { code: 1 });
  const stdout = `C:\\private\\Controller.cs(1,1): error CS0006: Metadata file 'C:\\private\\secret.dll' unavailable PRIVATE_COMPILER_CANARY\n${'error CS0001: bounded '.repeat(2000)}`;
  const callback = vi.fn(), observe = vi.fn(), returned = { pid: 123 }, options = { env: {} };
  const invoke = vi.fn((_file: string, _args: string[], _options: object, done: Callback) => { done(error, stdout, ''); return returned; });
  const wrapped = observeCompilerFailures(invoke, observe);
  expect(wrapped(compiler, arguments_, options, callback)).toBe(returned);
  expect(invoke).toHaveBeenCalledWith(compiler, arguments_, options, expect.any(Function));
  expect(callback).toHaveBeenCalledExactlyOnceWith(error, stdout, '');
  expect(observe).toHaveBeenCalledOnce();
  expect(observe.mock.calls[0]?.[0]).toMatchObject({ exitCode: 1 });
  const report = JSON.stringify(observe.mock.calls[0]?.[0]);
  expect(report).toContain('CS0006'); expect(report).not.toMatch(/private\\\\|PRIVATE_COMPILER_CANARY|RAW_PRIVATE_CAUSE/u);
  expect(report.length).toBeLessThan(5000);
});

it('does not observe successful compilation, SDK execution or repository source compilation', () => {
  const observe = vi.fn(), done = vi.fn();
  const successful = observeCompilerFailures((_file: string, _args: string[], callback: Callback) => callback(null, '', ''), observe);
  successful(compiler, arguments_, done);
  const failed = observeCompilerFailures((_file: string, _args: string[], callback: Callback) => callback(new Error('PRIVATE_TOOL_DATA'), '', ''), observe);
  failed('node.exe', ['PRIVATE_MODEL_PROMPT'], done); failed(compiler, ['repository.cs'], done);
  expect(observe).not.toHaveBeenCalled(); expect(done).toHaveBeenCalledTimes(3);
});

it('never changes compiler failure delivery when the diagnostic sink fails', () => {
  const error = Object.assign(new Error('compiler failed'), { code: 1 }), done = vi.fn();
  const invoke = observeCompilerFailures((_file: string, _args: string[], callback: Callback) => callback(error, 'error CS0006: Missing reference', ''), () => { throw new Error('diagnostic disk failure'); });
  expect(() => invoke(compiler, arguments_, done)).not.toThrow();
  expect(done).toHaveBeenCalledExactlyOnceWith(error, 'error CS0006: Missing reference', '');
});
