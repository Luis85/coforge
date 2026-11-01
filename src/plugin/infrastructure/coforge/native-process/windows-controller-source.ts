/** Fixed current-user lifetime supervisor. A Job is resource ownership, not filesystem isolation. */
export const windowsControllerSource = String.raw`
internal static class Controller {
 static int requested=0,stdoutClosed=0; static IntPtr job=IntPtr.Zero,owner=IntPtr.Zero;
 static string directory; static Authority authority; static Receipt receipt;
 static int originalPid=0;static string originalBirth=null;
 static bool recovering=false;
 static string JobName() {return "Local\\CoForgeNative-"+authority.ownerToken;}
 static T ReadJson<T>(string bytes) {using(var stream=new MemoryStream(Encoding.UTF8.GetBytes(bytes)))return (T)new DataContractJsonSerializer(typeof(T)).ReadObject(stream);}
 static string ReadLine(StreamReader reader) {var text=new StringBuilder();while(true){int value=reader.Read();if(value<0)return text.Length==0?null:text.ToString();if(value==10)return text.ToString();if(text.Length>=16*1024*1024)throw new IOException();text.Append((char)value);}}
 static string Quote(string value) {
  var text=new StringBuilder("\"");int slash=0;
  foreach(char c in value){if(c=='\\'){slash++;continue;}if(c=='"'){text.Append('\\',slash*2+1);text.Append(c);slash=0;continue;}text.Append('\\',slash);slash=0;text.Append(c);}
  text.Append('\\',slash*2);return text.Append('"').ToString();
 }
 static Thread Forward(IntPtr handle,Stream output,bool rootOutput=false) {
  var thread=new Thread(()=>{try{using(var input=new FileStream(new SafeFileHandle(handle,true),FileAccess.Read,8192,false)){input.CopyTo(output);output.Flush();}if(rootOutput)Interlocked.Exchange(ref stdoutClosed,1);}catch{Interlocked.CompareExchange(ref requested,3,0);}});
  thread.IsBackground=true;thread.Start();return thread;
 }
 static uint Active() {Native.Accounting value;Native.Check(Native.QueryInformationJobObject(job,1,out value,Marshal.SizeOf(typeof(Native.Accounting)),IntPtr.Zero));return value.active;}
 static void SaveReceipt() {
  receipt.controllerPid=originalPid==0?Native.GetCurrentProcessId():originalPid;receipt.controllerBirth=originalBirth??Native.Birth(Native.GetCurrentProcess()).ToString();receipt.authority=authority;
  receipt.finishedAt=DateTime.UtcNow.ToString("o");
  string target=Path.Combine(directory,"receipt.json"),pending=Path.Combine(directory,receipt.proof=="recovery"?"recovery.pending":"receipt.pending");
  using(var stream=new FileStream(pending,FileMode.CreateNew,FileAccess.Write,FileShare.None)){new DataContractJsonSerializer(typeof(Receipt)).WriteObject(stream,receipt);stream.Flush(true);}
  File.Move(pending,target);
 }
 static int Identity(string[] args) {
  int pid;if(args.Length!=2||!Int32.TryParse(args[1],out pid)||pid<1)return 64;
  var process=Native.OpenProcess(0x101000,false,pid);
  if(process==IntPtr.Zero){if(Marshal.GetLastWin32Error()==87){Console.Write("null");return 0;}Native.Check(false);}
  try {
   var state=Native.WaitForSingleObject(process,0);if(state==0){Console.Write("null");return 0;}if(state!=258)throw new IOException();
   var identity=new ProcessIdentityRecord{pid=pid,birth=Native.Birth(process).ToString(),imagePath=Native.ImagePath(process)};
   new DataContractJsonSerializer(typeof(ProcessIdentityRecord)).WriteObject(Console.OpenStandardOutput(),identity);return 0;
  }finally{Native.Close(ref process);}
 }
 static int Recover(string[] args) {
  if(args.Length!=5&&args.Length!=6)return 64;directory=args[1];authority=ReadJson<Authority>(File.ReadAllText(Path.Combine(directory,"owner.json")));
  originalPid=Int32.Parse(args[2]);originalBirth=args[3];
  owner=Native.OpenProcess(0x101001,false,originalPid);Native.Check(owner!=IntPtr.Zero);
  // The host has matched the existing JavaScript image fingerprint. Hold this same birth/path through termination.
  if(Native.Birth(owner).ToString()!=originalBirth||(args.Length==6?!String.Equals(Native.ImagePath(owner),args[5],StringComparison.Ordinal):Native.Image(owner)!=args[4]))return 73;
  job=Native.OpenJobObject(0x10000C,false,JobName());Native.Check(job!=IntPtr.Zero);
  Native.Check(Native.TerminateJobObject(job,130));Native.Check(Native.TerminateProcess(owner,130));Native.Check(Native.WaitForSingleObject(owner,5000)==0);
  var until=DateTime.UtcNow.AddSeconds(8);while(Active()!=0&&DateTime.UtcNow<until)Thread.Sleep(20);
  receipt=new Receipt{rootExitCode=-1,reason="owner-lost",proof="recovery",activeProcesses=(int)Active()};receipt.quiescent=receipt.activeProcesses==0;
  if(File.Exists(Path.Combine(directory,"receipt.json")))return 0;
  SaveReceipt();return receipt.quiescent?0:70;
 }
 static void Run(StreamReader control) {
  var bootstrapLine=ReadLine(control);if(bootstrapLine==null){receipt.reason="owner-lost";receipt.quiescent=true;receipt.activeProcesses=0;return;}
  var input=ReadJson<Bootstrap>(bootstrapLine);
  if(input==null||String.IsNullOrEmpty(input.executable)||!Path.IsPathRooted(input.executable)||String.IsNullOrEmpty(input.cwd)||!Path.IsPathRooted(input.cwd)||input.args==null)throw new IOException();
  owner=Native.OpenProcess(0x101000,false,input.parentPid);Native.Check(owner!=IntPtr.Zero);
  if(Native.Birth(owner).ToString()!=input.parentBirth||Native.WaitForSingleObject(owner,0)!=258)throw new IOException();
  var listening=new Thread(()=>{try{while(true){var line=ReadLine(control);if(line==null||line=="owner-lost"){Interlocked.CompareExchange(ref requested,2,0);return;}if(line=="cancel"){Interlocked.CompareExchange(ref requested,1,0);return;}if(line=="timeout"){Interlocked.CompareExchange(ref requested,4,0);return;}}}catch{Interlocked.CompareExchange(ref requested,2,0);}});
  listening.IsBackground=true;listening.Start();
  IntPtr inRead=IntPtr.Zero,inWrite=IntPtr.Zero,outRead=IntPtr.Zero,outWrite=IntPtr.Zero,errRead=IntPtr.Zero,errWrite=IntPtr.Zero,list=IntPtr.Zero,jobValue=IntPtr.Zero,handles=IntPtr.Zero;
  Native.ProcessInfo process=new Native.ProcessInfo();Thread stdout=null,stderr=null;
  try {
   var security=new Native.Security{length=Marshal.SizeOf(typeof(Native.Security)),inherit=true};
   Native.Check(Native.CreatePipe(out inRead,out inWrite,ref security,0));Native.Check(Native.SetHandleInformation(inWrite,1,0));
   Native.Check(Native.CreatePipe(out outRead,out outWrite,ref security,0));Native.Check(Native.SetHandleInformation(outRead,1,0));
   Native.Check(Native.CreatePipe(out errRead,out errWrite,ref security,0));Native.Check(Native.SetHandleInformation(errRead,1,0));
   IntPtr size=IntPtr.Zero;Native.InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);list=Marshal.AllocHGlobal(size);Native.Check(Native.InitializeProcThreadAttributeList(list,2,0,ref size));
   jobValue=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(jobValue,job);
   handles=Marshal.AllocHGlobal(IntPtr.Size*3);Marshal.WriteIntPtr(handles,0,inRead);Marshal.WriteIntPtr(handles,IntPtr.Size,outWrite);Marshal.WriteIntPtr(handles,IntPtr.Size*2,errWrite);
   Native.Check(Native.UpdateProcThreadAttribute(list,0,new IntPtr(0x2000D),jobValue,new IntPtr(IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
   Native.Check(Native.UpdateProcThreadAttribute(list,0,new IntPtr(0x20002),handles,new IntPtr(IntPtr.Size*3),IntPtr.Zero,IntPtr.Zero));
   var startup=new Native.StartupEx();startup.startup.cb=Marshal.SizeOf(typeof(Native.StartupEx));startup.startup.flags=0x100;startup.startup.stdin=inRead;startup.startup.stdout=outWrite;startup.startup.stderr=errWrite;startup.attributes=list;
   var argv=new StringBuilder(Quote(input.executable));foreach(string arg in input.args)argv.Append(' ').Append(input.windowsVerbatimArguments?arg:Quote(arg));if(argv.Length>=32767)throw new IOException();
   if(requested!=0||Native.WaitForSingleObject(owner,0)!=258){receipt.reason="owner-lost";return;}
   Native.Check(Native.CreateProcess(input.executable,argv,IntPtr.Zero,IntPtr.Zero,true,0x08080000,IntPtr.Zero,input.cwd,ref startup,out process));
   receipt.rootPid=process.pid;Native.Close(ref process.thread);Native.Close(ref inRead);Native.Close(ref outWrite);Native.Close(ref errWrite);
   File.WriteAllText(Path.Combine(directory,"started.json"),"{\"ownerToken\":\""+authority.ownerToken+"\",\"pid\":"+process.pid+"}",new UTF8Encoding(false));
   stdout=Forward(outRead,Console.OpenStandardOutput(),true);outRead=IntPtr.Zero;stderr=Forward(errRead,Console.OpenStandardError());errRead=IntPtr.Zero;
   var writing=inWrite;inWrite=IntPtr.Zero;var prompt=Convert.FromBase64String(input.input??"");
   var writer=new Thread(()=>{try{using(var stream=new FileStream(new SafeFileHandle(writing,true),FileAccess.Write)){stream.Write(prompt,0,prompt.Length);stream.Flush();}}catch{}});writer.IsBackground=true;writer.Start();
   // Once the root output channel ends, only bounded connection settlement remains: this is not a task deadline.
   System.Diagnostics.Stopwatch settling=null;
   while(Native.WaitForSingleObject(process.process,50)==258){
    if(Native.WaitForSingleObject(owner,0)!=258)Interlocked.CompareExchange(ref requested,2,0);
    if(input.watchRootOutputClosure&&Interlocked.CompareExchange(ref stdoutClosed,0,0)!=0){if(settling==null)settling=System.Diagnostics.Stopwatch.StartNew();if(settling.ElapsedMilliseconds>=2000)Interlocked.CompareExchange(ref requested,5,0);}
    if(requested!=0)break;
   }
   if(Native.WaitForSingleObject(owner,0)!=258)Interlocked.Exchange(ref requested,2);
   uint exitCode;if(Native.GetExitCodeProcess(process.process,out exitCode)&&exitCode!=259)receipt.rootExitCode=unchecked((int)exitCode);
   receipt.reason=requested==1?"cancelled":requested==4?"timeout":requested==2?"owner-lost":requested==3?"unknown":requested==5?"transport-closed":"completed";
  } finally {
   Native.Check(Native.TerminateJobObject(job,130));
   var until=DateTime.UtcNow.AddSeconds(8);while(Active()!=0&&DateTime.UtcNow<until)Thread.Sleep(20);
   receipt.activeProcesses=(int)Active();receipt.quiescent=receipt.activeProcesses==0;
   if(stdout!=null&&!stdout.Join(2000))receipt.quiescent=false;if(stderr!=null&&!stderr.Join(2000))receipt.quiescent=false;
   Native.Close(ref process.process);Native.Close(ref process.thread);Native.Close(ref inRead);Native.Close(ref inWrite);Native.Close(ref outRead);Native.Close(ref outWrite);Native.Close(ref errRead);Native.Close(ref errWrite);
   if(list!=IntPtr.Zero){Native.DeleteProcThreadAttributeList(list);Marshal.FreeHGlobal(list);}if(jobValue!=IntPtr.Zero)Marshal.FreeHGlobal(jobValue);if(handles!=IntPtr.Zero)Marshal.FreeHGlobal(handles);
  }
 }
 public static int Main(string[] args) {
  receipt=new Receipt{rootExitCode=-1,reason="start-failed",proof="controller",activeProcesses=-1};
  try {
   if(args.Length==1&&args[0]=="--probe")return Native.Elevated()?74:0;
   if(args.Length>0&&args[0]=="--identity")return Identity(args);
   if(args.Length>0&&args[0]=="--recover"){recovering=true;return Recover(args);}
   if(args.Length!=1)return 64;directory=args[0];authority=ReadJson<Authority>(File.ReadAllText(Path.Combine(directory,"owner.json")));
   if(authority==null||authority.version!=1||authority.kind!="windows-job"||authority.directory!=directory||authority.ownerToken.Length!=64)return 64;
   if(Native.Elevated())throw new System.ComponentModel.Win32Exception(740);
   job=Native.CreateJobObject(IntPtr.Zero,JobName());Native.Check(job!=IntPtr.Zero);
   var limits=new Native.ExtendedLimits();limits.basic.flags=0x2000;Native.Check(Native.SetInformationJobObject(job,9,ref limits,Marshal.SizeOf(typeof(Native.ExtendedLimits))));
   using(var control=new StreamReader(Console.OpenStandardInput(),new UTF8Encoding(false,true),false,4096)){Run(control);}
  } catch(Exception error) {
   var win32=error as System.ComponentModel.Win32Exception;receipt.startupError=win32==null?1:win32.NativeErrorCode;
   try{if(job!=IntPtr.Zero){Native.TerminateJobObject(job,130);receipt.activeProcesses=(int)Active();receipt.quiescent=receipt.activeProcesses==0;}}catch{receipt.quiescent=false;}
  } finally {
   try{if(authority!=null&&!recovering)SaveReceipt();}catch{receipt.quiescent=false;}
   Native.Close(ref owner);Native.Close(ref job);
  }
  return receipt.quiescent?0:70;
 }
}
`;
