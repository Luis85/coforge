// TEST ONLY: fixed native/CLR startup observations; no task command, environment or compiler output is retained.
using System;
using System.Text;
using System.Runtime.InteropServices;
internal static class RestrictedTestProbe {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup {public int cb;public string reserved,desktop,title;public int x,y,width,height,columns,rows,fill,flags;public short show,reservedSize;public IntPtr reserved2,stdin,stdout,stderr;}
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {public IntPtr process,thread;public int pid,tid;}
 [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool CreateProcessAsUser(IntPtr token,string executable,StringBuilder argv,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string cwd,ref Startup startup,out ProcessInfo result);
 [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr value);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr value,uint timeout);
 [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint code);
 static string Quote(string value) {var result=new StringBuilder("\"");int n=0;foreach(char c in value){if(c=='\\'){n++;continue;}if(c=='"'){result.Append('\\',n*2+1).Append(c);n=0;continue;}result.Append('\\',n).Append(c);n=0;}return result.Append('\\',n*2).Append('"').ToString();}
 public static void Run(IntPtr token,string desktop,string node,string root,string phase) {
  const string script="const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path');"+
   "const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['PATH','PATHEXT','SYSTEMROOT','WINDIR','TEMP','TMP'].includes(key.toUpperCase())));const system=process.env.SystemRoot||process.env.SYSTEMROOT||'C:/Windows',framework=path.join(system,'Microsoft.NET/Framework64/v4.0.30319');"+
   "const reads={};for(const name of ['csc.exe','mscorlib.dll','System.Runtime.Serialization.dll']){try{const fd=fs.openSync(path.join(framework,name),'r');fs.closeSync(fd);reads[name]=true}catch(error){reads[name]=error.code}}"+
   "const result=cp.spawnSync(path.join(framework,'csc.exe'),['/nologo','/help'],{env,windowsHide:true,encoding:'utf8',timeout:10000,maxBuffer:65536});const report={nativeStarted:true,frameworkReads:reads,clrExitCode:result.status,signal:result.signal,errorCode:result.error?.code??null};"+
   "const psenv={...Object.fromEntries(Object.entries(process.env).filter(([key])=>['PATH','PATHEXT','SYSTEMROOT','WINDIR','TEMP','TMP','HOME','USERPROFILE'].includes(key.toUpperCase()))),LC_ALL:'C',TZ:'UTC'};"+
   "const source=`[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$ErrorActionPreference='Stop';$result=@{started=$true;self=$false;parent=$false};try{$p=Get-Process -Id $PID;$result.self=[bool]($p.Path -and $p.StartTime);$p.Dispose()}catch{};try{$p=Get-Process -Id ${process.pid};$result.parent=[bool]($p.Path -and $p.StartTime);$p.Dispose()}catch{};$result|ConvertTo-Json -Compress`;"+
   "const ps=cp.spawnSync(path.join(system,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-Command',source],{env:psenv,windowsHide:true,encoding:'utf8',timeout:8000,maxBuffer:4096});let observed;try{observed=JSON.parse(ps.stdout)}catch{};report.powershell={exitCode:ps.status,errorCode:ps.error?.code??null,started:observed?.started===true,ownIdentity:observed?.self===true,parentIdentity:observed?.parent===true};fs.writeFileSync(process.argv[1],JSON.stringify(report));";
  var process=new ProcessInfo();var startup=new Startup{cb=Marshal.SizeOf(typeof(Startup)),desktop=desktop,flags=0x100,stdin=GetStdHandle(-10),stdout=GetStdHandle(-11),stderr=GetStdHandle(-12)};
  var output=System.IO.Path.Combine(root,"reports","native-process","preflight-"+phase+".json");
  try {
   var args=new StringBuilder(Quote(node)+" -e "+Quote(script)+" "+Quote(output));
   if(!CreateProcessAsUser(token,node,args,IntPtr.Zero,IntPtr.Zero,true,0x08000000,IntPtr.Zero,root,ref startup,out process)){Console.WriteLine("Native preflight "+phase+" createError="+Marshal.GetLastWin32Error());return;}
   if(WaitForSingleObject(process.process,20000)!=0){TerminateProcess(process.process,124);WaitForSingleObject(process.process,5000);Console.WriteLine("Native preflight "+phase+" timedOut=true");return;}
   uint code;Console.WriteLine("Native preflight "+phase+" nodeExit="+(GetExitCodeProcess(process.process,out code)?code:127));
  }finally{if(process.thread!=IntPtr.Zero)CloseHandle(process.thread);if(process.process!=IntPtr.Zero)CloseHandle(process.process);}
 }
}
