param(
  [Parameter(Mandatory=$true)][string]$Svg,
  [int]$Width = 1600,
  [string]$Out = ""
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Svg)) { throw "SVG not found: $Svg" }
if ($Out -eq "") {
  $dir  = Split-Path $Svg -Parent
  $name = [System.IO.Path]::GetFileNameWithoutExtension($Svg)
  $Out  = Join-Path $dir ("render-" + $name + ".png")
}
$OutDir = Split-Path $Out -Parent
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }
$svgBytes = (Get-Item -LiteralPath $Svg).Length
$rs = "" + $Width + "x"
magick -background none $Svg -resize $rs $Out
if (-not (Test-Path -LiteralPath $Out)) { throw "render failed: $Out" }
$pngBytes = (Get-Item -LiteralPath $Out).Length
$dims = (magick identify -format "%wx%h" $Out)
if ($pngBytes -lt 40000) { Write-Warning "PNG only $pngBytes bytes - likely blank or clipped filter" }
"OK  svg=$svgBytes  png=$pngBytes  dims=$dims  out=$Out"