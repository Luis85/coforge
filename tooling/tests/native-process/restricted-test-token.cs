// TEST ONLY: give newly created IPC/process objects a normal same-user DACL; existing objects/tokens are untouched.
using System;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Security.AccessControl;
internal static class RestrictedTestToken {
 [StructLayout(LayoutKind.Sequential)] struct Pointer {public IntPtr value;}
 [StructLayout(LayoutKind.Sequential)] struct Sid {public IntPtr value;public uint flags;}
 [StructLayout(LayoutKind.Sequential)] struct Groups {public int count;public Sid first;}
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int kind,IntPtr value,int length,out int returned);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool SetTokenInformation(IntPtr token,int kind,ref Pointer value,int length);
 [DllImport("advapi32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text,uint revision,out IntPtr descriptor,out uint size);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetSecurityDescriptorDacl(IntPtr descriptor,out bool present,out IntPtr acl,out bool defaulted);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr value);
 static void Check(bool value) {if(!value)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());}
 static IntPtr Read(IntPtr token,int kind) {int size;GetTokenInformation(token,kind,IntPtr.Zero,0,out size);if(size<1||size>65536)throw new Exception("Invalid token metadata");var value=Marshal.AllocHGlobal(size);try{Check(GetTokenInformation(token,kind,value,size,out size));return value;}catch{Marshal.FreeHGlobal(value);throw;}}
 public static string Describe(IntPtr token) {
  var user=WindowsIdentity.GetCurrent().User;bool ownerUser=false,userAllow=false,adminAllow=false,systemAllow=false,usersEnabled=false,authenticatedEnabled=false;
  IntPtr value=Read(token,4);try{ownerUser=new SecurityIdentifier(Marshal.ReadIntPtr(value)).Equals(user);}finally{Marshal.FreeHGlobal(value);}
  value=Read(token,6);try {
   var acl=Marshal.ReadIntPtr(value);
   if(acl!=IntPtr.Zero){int length=(ushort)Marshal.ReadInt16(acl,2);if(length<8||length>65536)throw new Exception("Invalid token ACL");var bytes=new byte[length];Marshal.Copy(acl,bytes,0,length);var entries=new RawAcl(bytes,0);
    foreach(GenericAce entry in entries){var allow=entry as CommonAce;if(allow==null||allow.AceQualifier!=AceQualifier.AccessAllowed)continue;userAllow|=allow.SecurityIdentifier.Equals(user);adminAllow|=allow.SecurityIdentifier.IsWellKnown(WellKnownSidType.BuiltinAdministratorsSid);systemAllow|=allow.SecurityIdentifier.IsWellKnown(WellKnownSidType.LocalSystemSid);}
   }
  }finally{Marshal.FreeHGlobal(value);}
  value=Read(token,2);try{int count=Marshal.ReadInt32(value),offset=Marshal.OffsetOf(typeof(Groups),"first").ToInt32(),width=Marshal.SizeOf(typeof(Sid));if(count<0||count>1024)throw new Exception("Invalid token group count");for(int index=0;index<count;index++){var group=(Sid)Marshal.PtrToStructure(IntPtr.Add(value,offset+index*width),typeof(Sid));bool enabled=(group.flags&4)!=0&&(group.flags&0x10)==0;var sid=new SecurityIdentifier(group.value);usersEnabled|=enabled&&sid.IsWellKnown(WellKnownSidType.BuiltinUsersSid);authenticatedEnabled|=enabled&&sid.IsWellKnown(WellKnownSidType.AuthenticatedUserSid);}}finally{Marshal.FreeHGlobal(value);}
  return "ownerIsUser="+ownerUser+" userDacl="+userAllow+" adminDacl="+adminAllow+" systemDacl="+systemAllow+" usersEnabled="+usersEnabled+" authenticatedUsersEnabled="+authenticatedEnabled;
 }
 public static void Normalize(IntPtr token) {
  var user=WindowsIdentity.GetCurrent().User;IntPtr descriptor=IntPtr.Zero;uint size;
  try {
   Check(ConvertStringSecurityDescriptorToSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;"+user.Value+")",1,out descriptor,out size));
   bool present,defaulted;IntPtr acl;Check(GetSecurityDescriptorDacl(descriptor,out present,out acl,out defaulted));if(!present||acl==IntPtr.Zero)throw new Exception("Missing same-user DACL");
   var pointer=new Pointer{value=acl};Check(SetTokenInformation(token,6,ref pointer,Marshal.SizeOf(typeof(Pointer))));
  }finally{if(descriptor!=IntPtr.Zero)LocalFree(descriptor);}
 }
}
