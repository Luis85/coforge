import { sessionTextSanitizer } from '../../../src/plugin/infrastructure/coforge/provider-session-safety';

interface CompilerFailureDiagnostic { exitCode: number | string; signal?: string; errors: string[] }
function diagnostic(error: unknown, stdout: unknown, stderr: unknown): CompilerFailureDiagnostic {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const signal = error && typeof error === 'object' && 'signal' in error ? error.signal : undefined;
  const text = [stdout, stderr].filter(value => typeof value === 'string').join('\n');
  const sanitize = sessionTextSanitizer();
  return { exitCode: typeof code === 'number' && Number.isSafeInteger(code) || typeof code === 'string' && /^[A-Z0-9_:-]{1,80}$/u.test(code) ? code : 'unknown',
    ...(typeof signal === 'string' && /^SIG[A-Z]{1,20}$/u.test(signal) ? { signal } : {}),
    errors: [...text.matchAll(/\b(?:fatal )?error CS\d+:[^\r\n]*/gu)].slice(0, 8).map(match => sanitize(match[0], 512)) };
}
/** Test-only observation of the fixed controller compiler; no SDK/task output is observed. */
export function observeCompilerFailures<T extends (...parameters: never[]) => unknown>(invoke: T, observe: (value: CompilerFailureDiagnostic) => void): T {
  return new Proxy(invoke, { apply(target, receiver, parameters: unknown[]) {
    const [file, arguments_] = parameters, callback = parameters.at(-1);
    const controller = typeof file === 'string' && /(?:^|[\\/])csc\.exe$/iu.test(file) && Array.isArray(arguments_)
      && arguments_.some(value => typeof value === 'string' && /(?:^|[\\/])Controller\.cs$/u.test(value));
    if (controller && typeof callback === 'function') parameters[parameters.length - 1] = function(this: unknown, ...values: unknown[]) {
      if (values[0]) try { observe(diagnostic(values[0], values[1], values[2])); } catch { /* Diagnostics cannot change compiler delivery. */ }
      const result: unknown = Reflect.apply(callback, this, values); return result;
    };
    const result: unknown = Reflect.apply(target, receiver, parameters); return result;
  } });
}
