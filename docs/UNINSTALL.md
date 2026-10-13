# Uninstalling VaayuGuard

VaayuGuard is intentionally **not** removable like a normal app:

- It has **no Add/Remove Programs entry**, so it never appears in Windows
  Settings → Apps with an uninstall button.
- It runs from `%ProgramFiles%\VaayuGuard` (admin-protected) via a per-logon
  Scheduled Task, and a separate **watchdog** task + process restarts the
  agent if it is force-closed.

So an ordinary (non-admin) employee cannot stop or remove it. Removal requires
**both** a secret code **and** local administrator rights.

## Normal admin uninstall (code-gated)

1. Open **Command Prompt as Administrator**.
2. Run the installed agent with the `--uninstall` flag and the secret code:

   ```cmd
   "C:\Program Files\VaayuGuard\VaayuGuardAgent.exe" --uninstall <code>
   ```

   - Correct code → an **Uninstall** window opens. Click **Uninstall** to
     stop the agent + watchdog, remove both scheduled tasks and the browser
     extension policy, and delete all VaayuGuard files and local data.
   - Wrong or missing code → nothing is removed. (If you omit the code, a
     prompt asks for it; it must still be correct.)

Run it elevated, or file/task removal will be blocked by Windows even with the
right code.

## The secret code

The code is never stored in plaintext — only the SHA-256 hash of it is compiled
into the agent (`AgentOptions.UninstallCodeSha256`). The current default code is
`VG7K-29QX-4MZ8` and **must be changed before rollout**. To set a new code, hash it and
replace that value (or override per-fleet with the `VaayuGuard__UninstallCodeSha256`
setting), then publish a new agent build:

```powershell
$c = 'your-new-code'
-join ([System.Security.Cryptography.SHA256]::Create().
  ComputeHash([Text.Encoding]::UTF8.GetBytes($c)) | ForEach-Object { $_.ToString('x2') })
```

## IT fallback (no code)

`agent/install/uninstall.ps1`, run elevated, removes the agent without the code.
It is for IT use only — do not distribute it to employees.
