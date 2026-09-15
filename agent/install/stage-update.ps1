<#
.SYNOPSIS
  Publishes the agent and stages it for auto-update: computes its hash,
  copies the exe into the dashboard's public/agent folder, and writes
  manifest.json there. Already-installed agents pick this up automatically
  (see SelfUpdater.cs) — no more walking to every PC with a USB stick.

.PARAMETER Version
  The new version number. MUST match SelfUpdater.CurrentAgentVersion in
  agent/src/SelfUpdater.cs after you bump it there for this release —
  this script does not edit that file for you.

.EXAMPLE
  .\stage-update.ps1 -Version 2
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [int]$Version
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot | Split-Path -Parent | Split-Path -Parent
$agentSrc = Join-Path $repoRoot "agent\src"
$agentDist = Join-Path $repoRoot "agent\dist"
$publicAgentDir = Join-Path $repoRoot "dashboard\public\agent"

Write-Host "Publishing agent (Release, self-contained win-x64) ..."
Push-Location $agentSrc
try {
    dotnet publish -c Release -o $agentDist
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }
} finally {
    Pop-Location
}

$exePath = Join-Path $agentDist "VaayuGuardAgent.exe"
if (-not (Test-Path $exePath)) { throw "Published exe not found at $exePath" }

Write-Host "Computing SHA-256 ..."
$hash = (Get-FileHash -Path $exePath -Algorithm SHA256).Hash.ToLower()

New-Item -ItemType Directory -Force -Path $publicAgentDir | Out-Null
Copy-Item -Path $exePath -Destination (Join-Path $publicAgentDir "VaayuGuardAgent.exe") -Force

$manifest = @{
    version = $Version
    url     = "/agent/VaayuGuardAgent.exe"
    sha256  = $hash
} | ConvertTo-Json

Set-Content -Path (Join-Path $publicAgentDir "manifest.json") -Value $manifest -NoNewline

Write-Host ""
Write-Host "Staged version $Version at dashboard/public/agent/ (hash $hash)." -ForegroundColor Green
Write-Host "Reminder: SelfUpdater.CurrentAgentVersion in agent/src/SelfUpdater.cs must be bumped to $Version" -ForegroundColor Yellow
Write-Host "for THIS build before you publish it as v$Version, or it would immediately re-update itself." -ForegroundColor Yellow
Write-Host "Already-installed agents will pick this up within their update-check interval (default 4h)." -ForegroundColor Green
