# Serve TROPICO 2026 locally and open the exhibition.
#   pwsh -File tools\serve.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$url  = 'http://127.0.0.1:8123/'
Write-Host "TROPICO 2026 -> $url"
Start-Process 'python' -ArgumentList @('-m','http.server','8123','--bind','127.0.0.1','--directory',$root)
Start-Sleep -Seconds 2
Start-Process $url
