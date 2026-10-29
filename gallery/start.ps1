# Starts the local gallery server (if needed) and opens it in the browser.
$ErrorActionPreference = 'SilentlyContinue'
$gallery = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $gallery
$port = 8150
$url = "http://127.0.0.1:$port/gallery/"

function Test-Gallery {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return ($r.StatusCode -eq 200 -and $r.Content -match 'Model Room')
  } catch { return $false }
}

if (-not (Test-Gallery)) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('This gallery needs Node.js to serve the model folders. Install Node, then run this again.', 'The Model Room') | Out-Null
    exit 1
  }
  Start-Process -FilePath $node.Source -ArgumentList @('serve.mjs','8150') -WorkingDirectory $gallery -WindowStyle Hidden
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 300
    if (Test-Gallery) { break }
  }
}

if (-not (Test-Gallery)) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show('Could not start the gallery on port 8150. Run: node gallery/serve.mjs 8150', 'The Model Room') | Out-Null
  exit 1
}

Start-Process $url
