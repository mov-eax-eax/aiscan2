param(
  [string]$Out = ""
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$renders = Join-Path $root 'renders'
if ($Out -eq "") { $Out = Join-Path $renders 'contact-sheet.png' }
$files = Get-ChildItem -LiteralPath $renders -Filter '*.png' | Where-Object { $_.Name -ne 'contact-sheet.png' } | Sort-Object Name
if (-not $files) { throw "no renders in $renders" }
$list = @($files | ForEach-Object { $_.FullName })
magick montage $list -tile 2x -geometry 1180x885+20+20 -background '#0b0907' $Out
if (-not (Test-Path -LiteralPath $Out)) { throw "montage failed" }
"OK " + $Out + " " + (Get-Item -LiteralPath $Out).Length + " bytes  (" + $files.Count + " pieces)"
