<#
.SYNOPSIS
  Removes the VaayuGuard agent's Scheduled Task and installed binaries.

.PARAMETER Purge
  Also deletes %ProgramData%\VaayuGuard (device enrollment, local queue,
  consent record). Omit this to allow a later reinstall to reuse the
  existing enrollment without a new token.
#>
[CmdletBinding()]
param(
    [switch]$Purge,
    [string]$InstallDir = "$env:ProgramFiles\VaayuGuard"
)

$ErrorActionPreference = "Stop"
$taskName = "VaayuGuardAgent"

Write-Host "Stopping and removing the Scheduled Task ..."
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Get-Process -Name "VaayuGuardAgent" -ErrorAction SilentlyContinue | Stop-Process -Force

if (Test-Path $InstallDir) {
    Write-Host "Removing $InstallDir ..."
    Remove-Item -Path $InstallDir -Recurse -Force
}

if ($Purge) {
    $dataDir = "$env:ProgramData\VaayuGuard"
    if (Test-Path $dataDir) {
        Write-Host "Purging local state at $dataDir ..."
        Remove-Item -Path $dataDir -Recurse -Force
    }
}

Write-Host "VaayuGuard agent removed." -ForegroundColor Green
