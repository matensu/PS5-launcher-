Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class SpotifyWindowReader {
  private delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")]
  private static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")]
  private static extern bool IsWindowVisible(IntPtr hWnd);
  public static string GetBestTitle() {
    var procs = System.Diagnostics.Process.GetProcessesByName("Spotify");
    if (procs.Length == 0) return null;
    string best = null;
    foreach (var proc in procs) {
      uint targetPid = (uint)proc.Id;
      EnumWindows((hWnd, lParam) => {
        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);
        if (pid != targetPid || !IsWindowVisible(hWnd)) return true;
        var sb = new StringBuilder(512);
        if (GetWindowText(hWnd, sb, 512) <= 0) return true;
        string text = sb.ToString().Trim();
        if (string.IsNullOrEmpty(text) || text.Equals("Spotify", StringComparison.OrdinalIgnoreCase)) return true;
        if (best == null || text.Length > best.Length) best = text;
        return true;
      }, IntPtr.Zero);
    }
    return best;
  }
}
"@
$title = [SpotifyWindowReader]::GetBestTitle()
if (-not $title) { '{"found":false}'; exit 0 }
@{ found = $true; rawTitle = $title } | ConvertTo-Json -Compress
