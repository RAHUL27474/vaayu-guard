<#
.SYNOPSIS
  Installs the VaayuGuard agent on this PC and registers it to run at logon.

.DESCRIPTION
  Run this AFTER the employee consent conversation has happened. Copies the
  published agent next to this script into Program Files, saves the
  one-time enrollment token issued by a superadmin in the dashboard's
  Devices page, and registers a per-logon Scheduled Task (runs as the
  current user, not a Session-0 service — see project plan for why).

.PARAMETER EnrollmentToken
  The one-time token shown once when the device was created in the
  dashboard. Required.

.PARAMETER BackendUrl
  Optional override of the backend URL baked into appsettings.json (e.g.
  to point a pilot PC at a staging deployment). Sets a user-level
  VaayuGuard__BackendBaseUrl environment variable, which .NET's
  configuration system prefers over the JSON file.

.EXAMPLE
  .\install.ps1 -EnrollmentToken "a1b2c3...64 hex chars..."
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$EnrollmentToken,

    [string]$BackendUrl,

    [string]$InstallDir = "$env:ProgramFiles\VaayuGuard"
)

$ErrorActionPreference = "Stop"

# The person running this (elevated, "Run as Administrator") is not
# necessarily who logs into this PC day to day — on a managed/corporate
# machine, UAC elevation can run as a *different* admin account entirely.
# Registering the AtLogOn task for $env:USERNAME in that case silently
# creates a task that never fires for the actual daily user. Resolve the
# real interactively-logged-on console user instead.
$interactiveUser = (Get-CimInstance -ClassName Win32_ComputerSystem).UserName
if (-not $interactiveUser) {
    Write-Warning "Could not detect the interactive console user — falling back to the current process user ($env:USERDOMAIN\$env:USERNAME). If this PowerShell was elevated as a DIFFERENT account than the one that logs into this PC daily, the scheduled task will not survive a restart."
    $interactiveUser = "$env:USERDOMAIN\$env:USERNAME"
}
Write-Host "Registering the logon task for: $interactiveUser"

$sourceDir = $PSScriptRoot | Split-Path -Parent | Join-Path -ChildPath "dist"
if (-not (Test-Path $sourceDir)) {
    throw "Published agent not found at '$sourceDir'. Run 'dotnet publish -c Release -o ..\dist' from agent\src first."
}

Write-Host "Installing VaayuGuard agent to $InstallDir ..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Path (Join-Path $sourceDir "*") -Destination $InstallDir -Recurse -Force

$dataDir = "$env:ProgramData\VaayuGuard"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$tokenPath = Join-Path $dataDir "enroll.token"
Set-Content -Path $tokenPath -Value $EnrollmentToken -NoNewline
# Restrict the data directory to Administrators + SYSTEM + the current user
# — it holds the device's bearer token once enrolled.
icacls $dataDir /inheritance:r | Out-Null
icacls $dataDir /grant:r "SYSTEM:(OI)(CI)F" "BUILTIN\Administrators:(OI)(CI)F" "$($interactiveUser):(OI)(CI)F" | Out-Null

if ($BackendUrl) {
    [Environment]::SetEnvironmentVariable("VaayuGuard__BackendBaseUrl", $BackendUrl, "User")
    Write-Host "Backend URL override set for this user: $BackendUrl"
}

$exePath = Join-Path $InstallDir "VaayuGuardAgent.exe"
$taskName = "VaayuGuardAgent"

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $exePath -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $interactiveUser -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "VaayuGuard company-PC identity monitoring agent" | Out-Null

Write-Host "Starting agent now (so you don't have to log off/on to test) ..."
Start-ScheduledTask -TaskName $taskName

# Force-installs the WhatsApp identity helper extension in Chrome and Edge
# (no "Add to Chrome"/Developer-mode step for the CRE to click through) —
# needs HKLM write access, which this script has (it must be run elevated)
# but the CRE-facing single-exe installer usually doesn't. See
# extension/README.md for how the extension ID/update URL were produced.
$extensionId = "amkaccikccmobblkcmnndhengmpacfba"
$extensionUpdateUrl = "https://vaayuguard-bice.vercel.app/extension/update.xml"
$forcelistValue = "$extensionId;$extensionUpdateUrl"

function Set-ForcelistEntry {
    param([string]$KeyPath)
    # New-Item -Force on an ALREADY-EXISTING registry key wipes its existing
    # values instead of leaving them alone (confirmed live) -- would silently
    # delete any other extension already force-installed via this same
    # policy. Only create it when it's genuinely missing.
    if (-not (Test-Path $KeyPath)) { New-Item -Path $KeyPath -Force | Out-Null }
    $existing = Get-Item -Path $KeyPath
    $nextFree = 1
    $targetName = $null
    foreach ($name in $existing.GetValueNames()) {
        if ($name -match '^\d+$') {
            $n = [int]$name
            if ($n -ge $nextFree) { $nextFree = $n + 1 }
            if ((Get-ItemPropertyValue -Path $KeyPath -Name $name) -eq $forcelistValue) { $targetName = $name }
        }
    }
    if (-not $targetName) { $targetName = "$nextFree" }
    Set-ItemProperty -Path $KeyPath -Name $targetName -Value $forcelistValue -Type String
}

try {
    Set-ForcelistEntry -KeyPath "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
    Set-ForcelistEntry -KeyPath "HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist"
    Write-Host "WhatsApp identity extension force-install policy set for Chrome and Edge." -ForegroundColor Green
} catch {
    Write-Warning "Could not set the browser extension force-install policy: $_"
}

Write-Host ""
Write-Host "Done. The agent will also start automatically at every future logon." -ForegroundColor Green
Write-Host "On first run it will show the employee monitoring notice once." -ForegroundColor Green
