# Starts the local server (if needed) and opens the Sagrada Família model.
$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8141
$url = "http://127.0.0.1:$port/"

function Test-Model {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return ($r.StatusCode -eq 200 -and $r.Content -match 'Sagrada')
  } catch { return $false }
}

if (-not (Test-Model)) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($node) {
    Start-Process -WindowStyle Hidden -FilePath $node.Source -ArgumentList @("`"$root\serve.mjs`"", "$port") -WorkingDirectory $root
  } elseif ($python) {
    Start-Process -WindowStyle Hidden -FilePath $python.Source -ArgumentList @('-m', 'http.server', "$port", '--directory', "`"$root`"")
  } else {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('This model needs Node.js or Python to serve its files locally. Install one, then run start.ps1 again.', 'Sagrada Familia') | Out-Null
    exit 1
  }
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 350
    if (Test-Model) { break }
  }
}

if (-not (Test-Model)) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("The local server could not start on port $port. Open a PowerShell window in this folder and run: node serve.mjs $port", 'Sagrada Familia') | Out-Null
  exit 1
}

Start-Process $url
