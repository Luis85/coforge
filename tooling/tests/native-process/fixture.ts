import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';

const folders: string[] = [];
export async function nativeProcessFixture() {
  const contained = resolve('.nq'); await mkdir(contained, { recursive: true });
  const directory = await mkdtemp(join(contained, 'native-job-fixture-'));
  if (!directory.startsWith(contained + sep)) throw new Error('Unsafe native test fixture.'); folders.push(directory);
  const marker = join(directory, 'marker.txt'), stop = join(directory, 'stop');
  await writeFile(join(directory, 'daemon.cjs'), `const fs=require('node:fs');let n=0;const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(stop)})){clearInterval(timer);process.exit(0)}fs.writeFileSync(${JSON.stringify(marker)},String(++n))},50);setTimeout(()=>process.exit(0),8000);`);
  const source = `process.stdin.resume();process.stdin.on('end',()=>{const cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs');const child=cp.spawn(process.execPath,[path.join(__dirname,'daemon.cjs')],{detached:true,stdio:'ignore',windowsHide:true});child.unref();const ready=setInterval(()=>{if(!fs.existsSync(${JSON.stringify(marker)}))return;clearInterval(ready);process.stdout.write(JSON.stringify({type:'result',subtype:'success',is_error:false,structured_output:{summary:'Synthetic completion'}})+'\\n');${'HOLD'}},20);setTimeout(()=>process.exit(1),8000).unref();});`;
  return { directory, marker, source, script: join(directory, 'provider.cjs'),
    writeProvider: (hold = false) => writeFile(join(directory, 'provider.cjs'), source.replace('HOLD', hold ? `setInterval(()=>{if(require('node:fs').existsSync(${JSON.stringify(stop)}))process.exit(0)},50);setTimeout(()=>process.exit(0),8000);` : '')),
    readMarker: () => readFile(marker, 'utf8').catch(() => undefined) };
}
export async function cleanupNativeFixtures() {
  for (const directory of folders.splice(0)) {
    await writeFile(join(directory, 'stop'), 'stop').catch(() => undefined); await pause(100);
    if (!directory.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe native fixture cleanup.');
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
