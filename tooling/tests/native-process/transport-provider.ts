import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** A fixed SDK fixture closes its real root output handle; its writer never inherits that handle. */
export async function outputClosingProvider(directory: string, candidateResult = true): Promise<string> {
  const path = (value: string) => JSON.stringify(value);
  const source = `using System;using System.Text;using System.Threading;using System.IO;using System.Runtime.InteropServices;
class OutputClosingProvider {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup {public int cb;public string reserved,desktop,title;public int x,y,w,h,c,r,fill,flags;public short show,size;public IntPtr extra,stdin,stdout,stderr;}
 [StructLayout(LayoutKind.Sequential)] struct Info {public IntPtr process,thread;public int pid,tid;}
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern bool CreateProcess(string app,StringBuilder args,IntPtr ps,IntPtr ts,bool inherit,uint flags,IntPtr env,string cwd,ref Startup start,out Info info);
 [DllImport("kernel32.dll")]static extern IntPtr GetStdHandle(int kind);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")]static extern uint GetFileType(IntPtr handle);
 static int Main(){Console.In.ReadToEnd();var startup=new Startup{cb=Marshal.SizeOf(typeof(Startup))};Info child;
  if(!CreateProcess(${path(process.execPath)},new StringBuilder(${path('"' + process.execPath + '" "' + join(directory, 'daemon.cjs') + '"')}),IntPtr.Zero,IntPtr.Zero,false,0x08000000,IntPtr.Zero,${path(directory)},ref startup,out child))return 2;
  CloseHandle(child.thread);CloseHandle(child.process);var until=DateTime.UtcNow.AddSeconds(5);while(!File.Exists(${path(join(directory, 'marker.txt'))})&&DateTime.UtcNow<until)Thread.Sleep(20);
  Console.WriteLine(${path(candidateResult ? JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'Earlier result is not terminal proof' }, total_cost_usd: 0.2 }) : 'SDK output ended before a result')});Console.Out.Flush();
  // CLR/Node can retain duplicated stdio handles. Drop every pipe owned by this synthetic SDK, not another process.
  for(long handle=4;handle<65536;handle+=4){var pipe=new IntPtr(handle);if(GetFileType(pipe)==3)CloseHandle(pipe);}Thread.Sleep(30000);return 3;
 }
}`;
  const file = join(directory, 'OutputClosingProvider.cs'), executable = join(directory, 'OutputClosingProvider.exe'); await writeFile(file, source);
  await new Promise<void>((resolve, reject) => execFile(join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),
    ['/nologo', '/target:exe', '/out:' + executable, file], { windowsHide: true, timeout: 20000, maxBuffer: 12000 }, error => error ? reject(new Error('Synthetic SDK fixture compilation failed.')) : resolve()));
  return executable;
}
