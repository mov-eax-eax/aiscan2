# Start the ntfy background collector and print the UI URL.
#   .\start-collector.ps1
#   .\start-collector.ps1 -Port 9000 -MaxTopics 1000 -RefreshMinutes 10
#
# RETIRED 2026-09-15 - DO NOT RUN. This contacts ntfy.sh, which blocked this host at
# the IP level after sustained throttling. Kept as a record of method, not a working
# set. See AGENTS.md section 12.
param(
  [int]$Port = 8787,
  [int]$MaxTopics = 300,
  [int]$RefreshMinutes = 20,
  [string]$NtfyBase = "https://ntfy.sh"
)
$env:PORT = "$Port"
$env:MAX_TOPICS = "$MaxTopics"
$env:REFRESH_MINUTES = "$RefreshMinutes"
$env:NTFY_BASE = $NtfyBase
Write-Host ""
Write-Host "  ntfy collector" -ForegroundColor Cyan
Write-Host "  target   : $NtfyBase"
Write-Host "  ui       : http://127.0.0.1:$Port"
Write-Host "  maxTopics: $MaxTopics    refresh: $RefreshMinutes min"
Write-Host "  Ctrl+C   : save state and exit (resumes next run)"
Write-Host ""
node "$PSScriptRoot\..\src\collector.js"
