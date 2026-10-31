import { randomUUID } from 'node:crypto';
import { setInterval as interval, clearInterval } from 'node:timers';
import { oneOf, number, shape, text } from '../../../features/coforge/domain/check';
import { WorkerFiles } from './files';
import { WorkerStore } from './store';
import { WorkerService, type BuildExecutor } from './service';
import { nativeBuildExecutor } from './native-provider';
import { startWorkerServer } from './server';
import { workerWorkspaces } from './workspaces';
import { inputHash } from './protocol';
import { readNativeProcessIdentity } from './process-identity';

const launchCheck = shape({ version: oneOf([1] as const), workerId: text({ min: 1, max: 160 }), epoch: number({ integer: true, min: 1 }), nonce: text({ min: 1, max: 160 }),
  token: text({ pattern: /^[a-f0-9]{64}$/u }), sourceHash: text({ pattern: /^[a-f0-9]{64}$/u }) }, { strict: true });
/** Bundled CJS entry. The test seam injects a provider in its own bundle, never through task input or environment flags. */
export async function main(privateDirectory = process.argv[3], execute?: BuildExecutor) {
  if (!privateDirectory) throw new Error('An authorized private worker directory is required.');
  const files = new WorkerFiles(privateDirectory); await files.initialize();
  const launch = launchCheck(await files.read('launch.json'));
  if (inputHash(await files.source('worker-' + launch.sourceHash + '.cjs')) !== launch.sourceHash) throw new Error('The pinned worker bundle identity changed.');
  const identity = await readNativeProcessIdentity(process.pid); if (!identity) throw new Error('The supervisor OS identity could not be verified.');
  await files.create('daemon.json', { pid: process.pid, workerId: launch.workerId, nonce: launch.nonce, instance: randomUUID(), identity });
  const store = new WorkerStore(files, launch.workerId, launch.epoch); await store.initialize();
  const workspaces = workerWorkspaces(files); await workspaces.start();
  const service = new WorkerService(store, execute ?? nativeBuildExecutor(store, workspaces));
  await service.initializeCapacity();
  const server = await startWorkerServer(service, workspaces, launch);
  await files.write('descriptor.json', server.descriptor);
  const pulse = interval(() => { void service.tick().catch(() => { /* An unreadable journal remains quarantined, never relaunched. */ }); }, 1000);
  let closing = false;
  const close = () => { if (closing) return; closing = true; clearInterval(pulse); void service.close().then(() => server.close()).finally(() => { process.exitCode = 0; }); };
  process.once('SIGTERM', close); process.once('SIGINT', close);
  return { service, server, close };
}
