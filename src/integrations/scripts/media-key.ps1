param([int]$Vk = 0xB3)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MediaKeys {
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  public static void Press(byte vk) {
    keybd_event(vk, 0, 0, UIntPtr.Zero);
    keybd_event(vk, 0, 2, UIntPtr.Zero);
  }
}
"@
[MediaKeys]::Press([byte]$Vk)
