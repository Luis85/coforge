import { expect, it, vi } from 'vitest';
import { createServer } from 'node:net';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { list, record, text } from '../../../src/plugin/features/coforge/domain/check';
import { verificationFixture } from './fixture';
import { dockerControl } from '../../../src/plugin/infrastructure/coforge/verification/runtime';

it('runs hostile test code as UID65534 without host files, credentials, network, Docker socket or controller mutation authority', async () => {
  const f = await verificationFixture();
  const retained = f.input.onVerificationRuntime!;
  let actualPolicyObserved = false;
  f.input.onVerificationRuntime = async runtime => {
    await retained(runtime);
    if (runtime.phase !== 'created') return;
    const raw: unknown = JSON.parse(await dockerControl(runtime.dockerBin, runtime.endpoint, ['container', 'inspect', runtime.containerName]));
    if (!Array.isArray(raw) || raw.length !== 1) throw new Error('Original container inspection missing.');
    const container = record(raw[0]); const host = record(container.HostConfig); const config = record(container.Config);
    expect(host).toMatchObject({ NetworkMode: 'none', ReadonlyRootfs: true, Privileged: false, Memory: 1073741824, NanoCpus: 2000000000, PidsLimit: 128, Init: true });
    expect(config.User).toBe('0:0');
    expect(host.CapDrop).toEqual(['ALL']);
    expect(list(text())(host.CapAdd).map(capability => capability.replace(/^CAP_/u, '')).sort()).toEqual(['KILL', 'SETGID', 'SETUID']);
    expect(list(text())(host.SecurityOpt).some(value => /^no-new-privileges(?:=true)?$/u.test(value))).toBe(true);
    expect(list(text())(config.Env)).toEqual(expect.arrayContaining(['NODE_OPTIONS=', 'COFORGE_IMAGE_CANARY=']));
    actualPolicyObserved = true;
  };
  let contacts = 0;
  const listener = createServer(socket => { contacts++; socket.destroy(); });
  await new Promise<void>((resolve, reject) => { listener.once('error', reject); listener.listen(0, '0.0.0.0', resolve); });
  f.closeables.push(async () => { await new Promise<void>(resolve => listener.close(() => resolve())); });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('Canary listener unavailable.');
  const outside = join(f.outside, 'host-canary.txt');
  const script = `const fs=require('node:fs'); const net=require('node:net');
function read(path){try{fs.readFileSync(path);return 'readable';}catch(error){return error.code;}}
function write(path){try{fs.writeFileSync(path,'ATTACK');return 'writable';}catch(error){return error.code;}}
function signal(pid){try{process.kill(pid,'SIGTERM');return 'signalled';}catch(error){return error.code;}}
async function connect(host){return await new Promise(resolve=>{const socket=net.connect({host,port:${address.port}});const timer=setTimeout(()=>{socket.destroy();resolve(false)},400);socket.once('connect',()=>{clearTimeout(timer);socket.destroy();resolve(true)});socket.once('error',()=>{clearTimeout(timer);resolve(false)});});}
(async()=>{const result={
  uid:process.getuid(), gid:process.getgid(),
  outside:read(${JSON.stringify(outside)}),
  liveSource:read(${JSON.stringify(join(f.source, '.env'))}),
  env:read('/source/.env'), managed:read('/source/Managed/Note.md'), git:read('/source/.git/config'),
  socket:fs.existsSync('/var/run/docker.sock'),
  secret:process.env.COFORGE_FIXTURE_HOST_SECRET??null,
  imageCanary:process.env.COFORGE_IMAGE_CANARY??null,
  nodeOptions:process.env.NODE_OPTIONS??null,
  preloadMarker:fs.existsSync('/tmp/privileged-preload-ran'),
  imageDependency:require('fixture-dependency'), hostDependencies:fs.existsSync('/source/node_modules'),
  rootEnvironment:read('/proc/1/environ'),
  helperWrite:write('/coforge/runner.cjs'), commandWrite:write('/coforge/command.json'),
  sourceWrite:write('/source/feature.cjs'),
  rootSignal:signal(1), controllerSignal:signal(process.ppid),
  network:await Promise.all(['127.0.0.1','172.17.0.1','192.168.65.2'].map(connect))
};
fs.writeFileSync('/work/private-write.txt','allowed private write'); fs.writeFileSync('/work/feature.cjs','module.exports=999'); console.log('COFORGE_CANARY='+JSON.stringify(result));})().catch(()=>process.exit(3));`;
  await writeFile(join(f.source, 'check.cjs'), script);
  vi.stubEnv('COFORGE_FIXTURE_HOST_SECRET', 'SECRET_NEVER_GIVEN_TO_CONTAINER');
  try {
    const session = await f.open(); const observed = await session.run({ commandId: 'check' });
    expect(observed).toMatchObject({ status: 'completed', exitCode: 0 });
    const line = observed.output.split('\n').find(line => line.startsWith('COFORGE_CANARY='));
    if (!line) throw new Error('The actual container returned no canary evidence.');
    const result = record(JSON.parse(line.slice('COFORGE_CANARY='.length)));
    expect(result).toMatchObject({ uid: 65534, gid: 65534, socket: false, secret: null, imageCanary: null, nodeOptions: null, preloadMarker: false, imageDependency: 2, hostDependencies: false, rootSignal: 'EPERM', controllerSignal: 'EPERM', network: [false, false, false] });
    for (const key of ['outside', 'liveSource', 'env', 'managed', 'git', 'rootEnvironment']) expect(result[key]).not.toBe('readable');
    for (const key of ['helperWrite', 'commandWrite', 'sourceWrite']) expect(['EROFS', 'EACCES', 'EPERM']).toContain(result[key]);
    expect(contacts).toBe(0);
    expect(actualPolicyObserved).toBe(true);
    expect(await readFile(join(f.source, 'feature.cjs'), 'utf8')).toBe('module.exports=1;\n');
    await expect(readFile(join(f.source, 'private-write.txt'))).rejects.toThrow();
    await f.assertSourceUnchanged();
  } finally { vi.unstubAllEnvs(); }
});
