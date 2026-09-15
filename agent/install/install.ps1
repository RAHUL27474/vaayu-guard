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
icacls $dataDir /grant:r "SYSTEM:(OI)(CI)F" "BUILTIN\Administrators:(OI)(CI)F" "$($env:USERDOMAIN)\$($env:USERNAME):(OI)(CI)F" | Out-Null

if ($BackendUrl) {
    [Environment]::SetEnvironmentVariable("VaayuGuard__BackendBaseUrl", $BackendUrl, "User")
    Write-Host "Backend URL override set for this user: $BackendUrl"
}

$exePath = Join-Path $InstallDir "VaayuGuardAgent.exe"
$taskName = "VaayuGuardAgent"

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $exePath -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "VaayuGuard company-PC identity monitoring agent" | Out-Null

Write-Host "Starting agent now (so you don't have to log off/on to test) ..."
Start-ScheduledTask -TaskName $taskName

Write-Host ""
Write-Host "Done. The agent will also start automatically at every future logon." -ForegroundColor Green
Write-Host "On first run it will show the employee monitoring notice once." -ForegroundColor Green
