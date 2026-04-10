#Requires -Version 5.1
<#
.SYNOPSIS
  Enables MongoDB replica set "rs0" for local Windows service (no Docker).
  Required for multi-document transactions (e.g. merit transfer).

.DESCRIPTION
  1) Patches mongod.cfg (from MongoDB Windows service command line) to set replication.replSetName: rs0
  2) Restarts the MongoDB service
  3) Runs replSetInitiate via Node + mongodb driver (scripts/windows/mongo-rs-initiate.cjs)

  Run in elevated PowerShell: Right-click -> Run as administrator.

.NOTES
  Backs up mongod.cfg to mongod.cfg.bak before editing.
#>

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal(
  [Security.Principal.WindowsIdentity]::GetCurrent()
)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'ERROR: Run this script as Administrator (elevated PowerShell).' -ForegroundColor Red
  exit 1
}

$svc = Get-CimInstance Win32_Service -Filter "Name='MongoDB'" -ErrorAction Stop
if (-not $svc) {
  Write-Host "ERROR: Windows service 'MongoDB' not found." -ForegroundColor Red
  exit 1
}

if ($svc.PathName -notmatch '--config\s+"([^"]+)"') {
  Write-Host 'ERROR: Could not parse --config path from service PathName:' $svc.PathName -ForegroundColor Red
  exit 1
}
$cfgPath = $Matches[1]
Write-Host "Using config: $cfgPath"

$raw = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8
if ($raw -match 'replSetName\s*:\s*rs0') {
  Write-Host 'replSetName rs0 already present in config; skipping file edit.'
} else {
  Copy-Item -LiteralPath $cfgPath -Destination ($cfgPath + '.bak') -Force
  # Default MongoDB 8.x Windows template: "#replication:" then blank lines then "#sharding:"
  if ($raw -match '(?ms)#replication:\s*\r?\n\s*\r?\n#sharding:') {
    $raw = $raw -replace '(?ms)#replication:\s*\r?\n\s*\r?\n#sharding:', "replication:`r`n  replSetName: rs0`r`n`r`n#sharding:"
  } elseif ($raw -match '(?ms)^replication:\s*\r?\n\s*\r?\n') {
    $raw = $raw -replace '(?ms)^(replication:\s*\r?\n)(\s*\r?\n)', "`$1  replSetName: rs0`r`n`$2"
  } else {
    $raw = $raw.TrimEnd() + "`r`n`r`nreplication:`r`n  replSetName: rs0`r`n"
  }
  [System.IO.File]::WriteAllText($cfgPath, $raw, [System.Text.UTF8Encoding]::new($false))
  Write-Host 'Updated mongod.cfg (backup: .bak)'
}

Write-Host 'Restarting MongoDB service...'
Restart-Service -Name 'MongoDB' -Force
Start-Sleep -Seconds 4

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$scriptRel = 'scripts/windows/mongo-rs-initiate.cjs'
$scriptPath = Join-Path $repoRoot $scriptRel
if (-not (Test-Path $scriptPath)) {
  Write-Host "ERROR: Missing $scriptPath" -ForegroundColor Red
  exit 1
}

Push-Location $repoRoot
try {
  & pnpm --filter @meriter/api exec node $scriptRel
  if ($LASTEXITCODE -ne 0) { throw "mongo-rs-initiate exited $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Done. Set in api/.env:' -ForegroundColor Green
Write-Host '  MONGO_URL=mongodb://127.0.0.1:27017/meriter?replicaSet=rs0' -ForegroundColor Cyan
