<#
.SYNOPSIS
  Build and run docker-compose.local.yml with pilot env aligned to current git branch.

.DESCRIPTION
  - Branch `dev`: forces pilot flags OFF for this compose run (overrides root .env for substituted vars).
  - Branch `pilot` or `feat/multi-obraz-pilot`: forces pilot ON; hub id must be set in root .env (or exported).
  - Other branches: does not change pilot env (compose uses .env only).

  Docker Compose: values in the shell environment override .env for the same keys.

  Usage (repo root, PowerShell):
    .\scripts\windows\run-docker-local.ps1
    .\scripts\windows\run-docker-local.ps1 -Detached

.PARAMETER Detached
  Run `docker compose up -d` instead of foreground.
#>
param(
  [switch] $Detached
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

if (-not (Test-Path ".env")) {
  Write-Error "Missing root .env — copy from .env.example and configure."
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "[run-docker-local] Git branch: $branch"

$pilotBranches = @("pilot", "feat/multi-obraz-pilot")
$isPilotBranch = $pilotBranches -contains $branch

if ($branch -eq "dev") {
  $env:NEXT_PUBLIC_PILOT_MODE = "false"
  $env:NEXT_PUBLIC_PILOT_STANDALONE = "false"
  $env:NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID = ""
  $env:PILOT_MODE = "false"
  $env:PILOT_HUB_COMMUNITY_ID = ""
  Write-Host "[run-docker-local] Pilot flags forced OFF for this compose run (Meriter full UI)."
}
elseif ($isPilotBranch) {
  $env:NEXT_PUBLIC_PILOT_MODE = "true"
  $env:PILOT_MODE = "true"
  Write-Host "[run-docker-local] Pilot flags forced ON (Multi-Obraz). Hub id must come from .env (NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID / PILOT_HUB_COMMUNITY_ID)."
  if (-not $env:PILOT_HUB_COMMUNITY_ID -and -not $env:NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID) {
    Write-Warning "PILOT_HUB_COMMUNITY_ID / NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID not set in environment. Set them in root .env before creating dreams."
  }
}
else {
  Write-Host "[run-docker-local] Branch is not dev/pilot — pilot env not auto-toggled (using .env only)."
}

$composeFile = "docker-compose.local.yml"
if (-not (Test-Path $composeFile)) {
  Write-Error "Missing $composeFile in repo root."
}

$upArgs = @("-f", $composeFile, "up", "--build")
if ($Detached) {
  $upArgs += "-d"
}

Write-Host "[run-docker-local] docker compose $($upArgs -join ' ')"
& docker compose @upArgs
