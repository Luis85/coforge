// TEST ONLY: qualify the production non-admin controller on administrator-hosted Windows CI.
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Security.Principal;
internal static class RestrictedAcceptance {
 [StructLayout(LayoutKind.Sequential)] struct Sid { public IntPtr value; public uint flags; }
 [StructLayout(LayoutKind.Sequential)] struct Groups {public int count;public Sid first;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup { public int cb;public string reserved,desktop,title;public int x,y,width,height,columns,rows,fill,flags;public short show,reservedSize;public IntPtr reserved2,stdin,stdout,stderr; }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread;public int pid,tid; }
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint timeout);
 [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token,uint flags,uint disabled,ref Sid sids,uint deleted,IntPtr privileges,uint restricted,IntPtr restrictions,out IntPtr result);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool SetTokenInformation(IntPtr token,int kind,ref Sid value,int length);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int kind,out int value,int length,out int returned);
 [DllImport("advapi32.dll",SetLastError=true,EntryPoint="GetTokenInformation")] static extern bool ReadTokenInformation(IntPtr token,int kind,IntPtr value,int length,out int returned);
 [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool CreateProcessAsUser(IntPtr token,string executable,StringBuilder argv,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string cwd,ref Startup startup,out ProcessInfo result);
 static void Check(bool value) {if(!value)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());}
 static IntPtr SidBytes(SecurityIdentifier sid) {byte[] bytes=new byte[sid.BinaryLength];sid.GetBinaryForm(bytes,0);var value=Marshal.AllocHGlobal(bytes.Length);Marshal.Copy(bytes,0,value,bytes.Length);return value;}
 static string Quote(string value) {var result=new StringBuilder("\"");int n=0;foreach(char c in value){if(c=='\\'){n++;continue;}if(c=='"'){result.Append('\\',n*2+1).Append(c);n=0;continue;}result.Append('\\',n).Append(c);n=0;}return result.Append('\\',n*2).Append('"').ToString();}
 static void AssertNormalToken(IntPtr token) {
  int size;ReadTokenInformation(token,25,IntPtr.Zero,0,out size);if(size<Marshal.SizeOf(typeof(Sid))||size>4096)throw new Exception("Invalid integrity record");
  IntPtr value=Marshal.AllocHGlobal(size);
  try {Check(ReadTokenInformation(token,25,value,size,out size));var level=(Sid)Marshal.PtrToStructure(value,typeof(Sid));if(new SecurityIdentifier(level.value).Value!="S-1-16-8192")throw new Exception("Acceptance token is not medium integrity");}
  finally {Marshal.FreeHGlobal(value);}
  ReadTokenInformation(token,2,IntPtr.Zero,0,out size);if(size<Marshal.SizeOf(typeof(Groups))||size>65536)throw new Exception("Invalid token group record");
  value=Marshal.AllocHGlobal(size);
  try {
   Check(ReadTokenInformation(token,2,value,size,out size));int count=Marshal.ReadInt32(value),offset=Marshal.OffsetOf(typeof(Groups),"first").ToInt32(),width=Marshal.SizeOf(typeof(Sid));
   if(count<0||count>(size-offset)/width)throw new Exception("Invalid token group count");
   for(int index=0;index<count;index++){var group=(Sid)Marshal.PtrToStructure(IntPtr.Add(value,offset+index*width),typeof(Sid));if(new SecurityIdentifier(group.value).IsWellKnown(WellKnownSidType.BuiltinAdministratorsSid)&&((group.flags&0x10)==0||(group.flags&4)!=0))throw new Exception("Acceptance administrator group is not deny-only");}
  } finally {Marshal.FreeHGlobal(value);}
 }
 public static int Main(string[] args) {
  if(args.Length!=3)return 64;IntPtr original=IntPtr.Zero,token=IntPtr.Zero,admin=IntPtr.Zero,medium=IntPtr.Zero;var child=new ProcessInfo();RestrictedTestDesktop desktop=null;
  try {
   Check(OpenProcessToken(GetCurrentProcess(),0xF01FF,out original));
   admin=SidBytes(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null));var disabled=new Sid{value=admin};
   // LUA_TOKEN + DISABLE_MAX_PRIVILEGE, with Administrators deny-only. The user/account is unchanged.
   Check(CreateRestrictedToken(original,5,1,ref disabled,0,IntPtr.Zero,0,IntPtr.Zero,out token));
   var integrity=new SecurityIdentifier("S-1-16-8192");medium=SidBytes(integrity);var level=new Sid{value=medium,flags=0x20};
   Check(SetTokenInformation(token,25,ref level,Marshal.SizeOf(typeof(Sid))+integrity.BinaryLength));
   int elevated,returned;Check(GetTokenInformation(token,20,out elevated,4,out returned));if(elevated!=0)throw new Exception("Acceptance child remained elevated");
   AssertNormalToken(token);
   // Hosted administrator desktops need not grant a filtered token the rights required by CLR initialization.
   desktop=new RestrictedTestDesktop();
   var startup=new Startup{cb=Marshal.SizeOf(typeof(Startup)),desktop=desktop.Name,flags=0x100,stdin=GetStdHandle(-10),stdout=GetStdHandle(-11),stderr=GetStdHandle(-12)};
   var argv=new StringBuilder(Quote(args[0])+" "+Quote(args[1])+" run --config configs/testing/vitest.native-process.config.mjs");
   Check(CreateProcessAsUser(token,args[0],argv,IntPtr.Zero,IntPtr.Zero,true,0,IntPtr.Zero,args[2],ref startup,out child));
   Console.WriteLine("Native acceptance: same-user non-admin medium-integrity token, administrator SID disabled, owned noninteractive desktop; no accounts or UAC settings changed.");
   WaitForSingleObject(child.process,0xFFFFFFFF);uint code;Check(GetExitCodeProcess(child.process,out code));return unchecked((int)code);
  } catch(Exception error) {var native=error as System.ComponentModel.Win32Exception;Console.Error.WriteLine("Native acceptance could not create its non-admin child: "+error.GetType().Name+" stage="+(error.Data["nativeAcceptanceStage"] as string??"token-or-launch")+(native==null?"":" win32="+native.NativeErrorCode));return 1;}
  finally {if(child.thread!=IntPtr.Zero)CloseHandle(child.thread);if(child.process!=IntPtr.Zero)CloseHandle(child.process);if(desktop!=null)desktop.Dispose();if(token!=IntPtr.Zero)CloseHandle(token);if(original!=IntPtr.Zero)CloseHandle(original);if(admin!=IntPtr.Zero)Marshal.FreeHGlobal(admin);if(medium!=IntPtr.Zero)Marshal.FreeHGlobal(medium);}
 }
}
