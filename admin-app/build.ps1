<#
.SYNOPSIS
  Builds "VaayuGuard Admin.exe" — the admin/developer desktop launcher.

.DESCRIPTION
  Uses the .NET Framework C# compiler that ships with Windows, so no SDK is
  needed and the exe runs on any Windows 10/11 PC without installing
  anything. Output: admin-app\dist\VaayuGuard Admin.exe
#>
$ErrorActionPreference = "Stop"
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$src = Join-Path $PSScriptRoot "VaayuGuardAdmin.cs"
$icon = Join-Path $PSScriptRoot "..\dashboard\src\app\favicon.ico"
$dist = Join-Path $PSScriptRoot "dist"

New-Item -ItemType Directory -Force -Path $dist | Out-Null
& $csc /nologo /target:winexe /optimize+ "/win32icon:$icon" "/out:$dist\VaayuGuard Admin.exe" $src
if ($LASTEXITCODE -ne 0) { throw "csc failed" }
Get-Item "$dist\VaayuGuard Admin.exe"
