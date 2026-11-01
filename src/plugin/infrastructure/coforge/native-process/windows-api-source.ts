/** Fixed P/Invoke declarations. This source contains no invocation or model data. */
export const windowsApiSource = String.raw`
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using Microsoft.Win32.SafeHandles;
internal static class Native {
 [StructLayout(LayoutKind.Sequential)] internal struct Security { public int length; public IntPtr descriptor; [MarshalAs(UnmanagedType.Bool)] public bool inherit; }
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] internal struct Startup {
  public int cb; public string reserved, desktop, title; public int x,y,xSize,ySize,xCount,yCount,fill,flags; public short show,reservedSize;
  public IntPtr reserved2, stdin, stdout, stderr;
 }
 [StructLayout(LayoutKind.Sequential)] internal struct StartupEx { public Startup startup; public IntPtr attributes; }
 [StructLayout(LayoutKind.Sequential)] internal struct ProcessInfo { public IntPtr process,thread; public int pid,tid; }
 [StructLayout(LayoutKind.Sequential)] internal struct BasicLimits {
  public long processTime,jobTime; public uint flags; public UIntPtr minWorking,maxWorking; public uint activeLimit; public UIntPtr affinity; public uint priority,scheduling;
 }
 [StructLayout(LayoutKind.Sequential)] internal struct Io { public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes; }
 [StructLayout(LayoutKind.Sequential)] internal struct ExtendedLimits { public BasicLimits basic; public Io io; public UIntPtr processMemory,jobMemory,peakProcessMemory,peakJobMemory; }
 [StructLayout(LayoutKind.Sequential)] internal struct Accounting { public long user,kernel,userPeriod,kernelPeriod; public uint faults,total,active,terminated; }
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern IntPtr CreateJobObject(IntPtr security,string name);
 [DllImport("kernel32.dll", SetLastError=true,CharSet=CharSet.Unicode)] internal static extern IntPtr OpenJobObject(uint access,bool inherit,string name);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll", SetLastError=true,CharSet=CharSet.Unicode)] internal static extern bool QueryFullProcessImageName(IntPtr process,int flags,StringBuilder path,ref int size);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool SetInformationJobObject(IntPtr job,int info,ref ExtendedLimits limits,int length);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool QueryInformationJobObject(IntPtr job,int info,out Accounting value,int length,IntPtr returned);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool TerminateJobObject(IntPtr job,uint code);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")] internal static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll", SetLastError=true,CharSet=CharSet.Unicode)] internal static extern bool CreateProcess(string executable,StringBuilder args,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string cwd,ref StartupEx startup,out ProcessInfo info);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref Security security,uint size);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll", SetLastError=true)] internal static extern bool GetProcessTimes(IntPtr process,out long creation,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll")] internal static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] internal static extern int GetCurrentProcessId();
 [DllImport("kernel32.dll")] internal static extern bool CloseHandle(IntPtr handle);
 [DllImport("advapi32.dll",SetLastError=true)] internal static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] internal static extern bool GetTokenInformation(IntPtr token,int kind,out int value,int length,out int returned);
 internal static void Check(bool valid) { if(!valid) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()); }
 internal static void Close(ref IntPtr handle) { if(handle!=IntPtr.Zero) { CloseHandle(handle);handle=IntPtr.Zero; } }
 internal static long Birth(IntPtr process) { long birth,exit,kernel,user;Check(GetProcessTimes(process,out birth,out exit,out kernel,out user));return DateTime.FromFileTimeUtc(birth).Ticks; }
 internal static string Image(IntPtr process) {var path=new StringBuilder(32768);int size=path.Capacity;Check(QueryFullProcessImageName(process,0,path,ref size));using(var sha=System.Security.Cryptography.SHA256.Create()){return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(path.ToString().Normalize().ToLowerInvariant()))).Replace("-","").ToLowerInvariant();}}
 internal static bool Elevated() { IntPtr token;Check(OpenProcessToken(GetCurrentProcess(),8,out token));try {int value,returned;Check(GetTokenInformation(token,20,out value,4,out returned));return value!=0;}finally{CloseHandle(token);} }
}
[DataContract] internal class Authority {
 [DataMember] public int version;
 [DataMember] public string kind,directory,ownerToken,sourceHash,runId,attemptId,projectId;
}
[DataContract] internal class Bootstrap {
 [DataMember] public string executable,cwd,input,parentBirth;
 [DataMember] public string[] args;
 [DataMember] public int parentPid;
 [DataMember] public bool windowsVerbatimArguments;
}
[DataContract] internal class Receipt {
 [DataMember] public Authority authority;
 [DataMember] public int controllerPid,rootPid,rootExitCode,startupError,activeProcesses;
 [DataMember] public string controllerBirth,reason,finishedAt;
 [DataMember] public bool quiescent;
 [DataMember] public string proof;
}
`;
