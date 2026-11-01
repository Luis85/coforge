import { afterEach, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { windowsControllerExecutable, nativeSystemEnvironment } from '../../../src/plugin/infrastructure/coforge/native-process/windows-controller';
import { cleanupNativeFixtures, nativeProcessFixture } from './fixture';

if (process.platform !== 'win32') throw new Error('Native Windows identity qualification requires Windows; no skipped substitute qualifies it.');
afterEach(cleanupNativeFixtures);
const run = promisify(execFile);

it('keeps exact legacy .NET UTC tick and image-path identity semantics without a PowerShell host', async () => {
  const f = await nativeProcessFixture();
  const source = join(f.directory, 'LegacyIdentity.cs'), executable = join(f.directory, 'LegacyIdentity.exe');
  await writeFile(source, 'using System;using System.Diagnostics;class LegacyIdentity{static void Main(string[] args){using(var p=Process.GetProcessById(Int32.Parse(args[0]))){Console.WriteLine(p.StartTime.ToUniversalTime().Ticks);Console.WriteLine(p.MainModule.FileName);}}}');
  await run(join(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'), ['/nologo', '/out:' + executable, source], { env: nativeSystemEnvironment(), windowsHide: true });
  const baseline = (await run(executable, [String(process.pid)], { env: nativeSystemEnvironment(), windowsHide: true })).stdout.trim().split(/\r?\n/u);
  const raw = await run(await windowsControllerExecutable(), ['--identity', String(process.pid)], { env: nativeSystemEnvironment(), windowsHide: true });
  expect(JSON.parse(raw.stdout)).toEqual({ pid: process.pid, birth: baseline[0], imagePath: baseline[1] });
});

it.each([false, true])('runs and recovers an actual Windows job when PowerShell is unavailable (Unicode controller path: %s)', async unicode => {
  const f = await nativeProcessFixture(); await f.writeProvider(true);
  const temp = join(f.directory, unicode ? 'İ-ΟΣ-runtime' : 'runtime'); await mkdir(temp);
  const bundle = join(f.directory, 'backend.cjs');
  await build({ entryPoints: ['src/plugin/infrastructure/coforge/native-process/owned-worktree-process.ts'], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const probe = join(f.directory, 'probe.cjs');
  await writeFile(probe, `
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
let powershellCalls=0;const original=cp.execFile;
cp.execFile=function(file,...args){
 if(file.toLowerCase().endsWith('powershell.exe')){powershellCalls++;queueMicrotask(()=>args.at(-1)(Object.assign(new Error('PowerShell unavailable'),{code:'ENOENT'}),'',''));return new cp.ChildProcess()}
 return original.call(this,file,...args);
};
const api=require(${JSON.stringify(bundle)});let handle;
(async()=>{
 handle=await api.startOwnedWorktreeProcess(process.execPath,[${JSON.stringify(f.script)}],{cwd:${JSON.stringify(f.directory)},input:'Synthetic task',owner:{projectId:'project',runId:'run',attemptId:'attempt'},onStarted:async()=>{}});
 for(let n=0;n<200&&!fs.existsSync(${JSON.stringify(f.marker)});n++)await new Promise(r=>setTimeout(r,20));
 if(!fs.existsSync(${JSON.stringify(f.marker)}))throw Error('SDK did not start');
 let deniedTamperedIdentities=true;
 for(const identity of [{...handle.identity,birth:'1'},{...handle.identity,image:'f'.repeat(64)},{...handle.identity,pid:process.pid}])
  deniedTamperedIdentities&&=await api.recoverOwnedWorktreeLifetime(identity,handle.lifetime)===undefined;
 const controller=path.join(path.dirname(handle.lifetime.directory),'coforge-native-controller-'+handle.lifetime.sourceHash,'Controller.exe');
 const deniedWrongPath=await new Promise(resolve=>cp.execFile(controller,['--recover',handle.lifetime.directory,String(handle.identity.pid),handle.identity.birth,handle.identity.image,'C:/not-the-original.exe'],{windowsHide:true},error=>resolve(error?.code===73)));
 const before=fs.readFileSync(${JSON.stringify(f.marker)},'utf8');await new Promise(r=>setTimeout(r,120));
 const stillRunning=fs.readFileSync(${JSON.stringify(f.marker)},'utf8')!==before;
 const receipt=await api.recoverOwnedWorktreeLifetime(handle.identity,handle.lifetime);
 process.stdout.write(JSON.stringify({powershellCalls,deniedTamperedIdentities,deniedWrongPath,stillRunning,quiescent:receipt?.quiescent,activeProcesses:receipt?.activeProcesses}));
 if(!receipt?.quiescent||!deniedTamperedIdentities||!deniedWrongPath||!stillRunning)process.exitCode=1;
})().catch(()=>{process.stdout.write(JSON.stringify({powershellCalls,failed:true}));process.exitCode=1}).finally(async()=>{if(handle)await handle.stop()});
setTimeout(()=>process.exit(2),20000).unref();`);
  const output = await run(process.execPath, [probe], { cwd: f.directory, env: { ...process.env, TEMP: temp, TMP: temp }, windowsHide: true, timeout: 25000, maxBuffer: 4000 });
  expect(JSON.parse(output.stdout)).toEqual({ powershellCalls: 0, deniedTamperedIdentities: true, deniedWrongPath: true, stillRunning: true, quiescent: true, activeProcesses: 0 });
});
