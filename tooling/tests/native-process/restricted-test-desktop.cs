// TEST ONLY: an owned desktop for a filtered CI token; never changes the default desktop or its ACL.
using System;
using System.Runtime.InteropServices;
using System.Security.Principal;
internal sealed class RestrictedTestDesktop : IDisposable {
 [StructLayout(LayoutKind.Sequential)] struct Security {public int length;public IntPtr descriptor;[MarshalAs(UnmanagedType.Bool)]public bool inherit;}
 [DllImport("user32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern IntPtr CreateWindowStation(string name,uint flags,uint access,ref Security security);
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr GetProcessWindowStation();
 [DllImport("user32.dll",SetLastError=true)] static extern bool SetProcessWindowStation(IntPtr station);
 [DllImport("user32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern IntPtr CreateDesktop(string name,IntPtr device,IntPtr mode,uint flags,uint access,ref Security security);
 [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr desktop);
 [DllImport("user32.dll")] static extern bool CloseWindowStation(IntPtr station);
 [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text,uint revision,out IntPtr descriptor,out uint size);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr value);
 IntPtr station=IntPtr.Zero,desktop=IntPtr.Zero;
 public string Name {get;private set;}
 static void Check(bool value,string stage) {if(!value){var error=new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());error.Data["nativeAcceptanceStage"]=stage;throw error;}}
 public RestrictedTestDesktop() {
  IntPtr descriptor=IntPtr.Zero;uint size;var original=GetProcessWindowStation();Check(original!=IntPtr.Zero,"GetProcessWindowStation");
  try {
   var user=WindowsIdentity.GetCurrent().User.Value;
   // An elevated creator's default high-integrity label would deny this medium token despite its user DACL.
   Check(ConvertStringSecurityDescriptorToSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;"+user+")S:(ML;;NW;;;ME)",1,out descriptor,out size),"CreateSecurityDescriptor");
   var security=new Security{length=Marshal.SizeOf(typeof(Security)),descriptor=descriptor};
   var name="CoForgeNativeAcceptance-"+Guid.NewGuid().ToString("N");
   station=CreateWindowStation(name,1,0xF037F,ref security);Check(station!=IntPtr.Zero,"CreateWindowStation");
   Check(SetProcessWindowStation(station),"SetOwnedWindowStation");
   try {desktop=CreateDesktop("OwnedTestDesktop",IntPtr.Zero,IntPtr.Zero,0,0xF01FF,ref security);Check(desktop!=IntPtr.Zero,"CreateDesktop");}
   finally {Check(SetProcessWindowStation(original),"RestoreOriginalWindowStation");}
   Name=name+"\\OwnedTestDesktop";
  } catch {Dispose();throw;}
  finally {if(descriptor!=IntPtr.Zero)LocalFree(descriptor);}
 }
 public void Dispose() {
  if(desktop!=IntPtr.Zero){CloseDesktop(desktop);desktop=IntPtr.Zero;}
  if(station!=IntPtr.Zero){CloseWindowStation(station);station=IntPtr.Zero;}
 }
}
