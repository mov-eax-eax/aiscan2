# overlay-trace.ps1 — trace Fig. 2 and DRAW THE RESULT BACK ON THE PLATE.
#
# This exists because of a recorded failure: twice in this project a detector was written
# and trusted without visually confirming what it was detecting (the "314 m tower", and a
# contaminated px/m scan). In round 1 the same thing happened a third time -- the trace
# locked onto the caption « DIAGRAMME DE L'ELEVATION ».
#
# So: draw the trace on the plate and LOOK at it. Metrics come after.

Add-Type -AssemblyName System.Drawing

$Plate = 'F:\repotest2\eiffel-tower-v3\research\sources\gallica\PL-I-f17-elevation.jpg'
$Out   = 'F:\repotest2\eiffel-tower-v4\research\refs\overlay-trace.png'
$X0 = 1950; $Y0 = 1700; $W = 2700; $H = 4700
$DARK = 150

$img = New-Object System.Drawing.Bitmap($Plate)
$bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0,0,$W,$H)),
                    (New-Object System.Drawing.Rectangle($X0,$Y0,$W,$H)), [System.Drawing.GraphicsUnit]::Pixel)

function IsInk([int]$x,[int]$y) {
  if ($x -lt $X0 -or $x -ge ($X0+$W) -or $y -lt $Y0 -or $y -ge ($Y0+$H)) { return $false }
  $p = $img.GetPixel($x,$y)
  return ((0.299*$p.R + 0.587*$p.G + 0.114*$p.B) -lt $DARK)
}

# ---- centre: widest single contiguous run in the lower tower ----
$bestW = 0; $centre = $X0 + [int]($W/2)
for ($y = 5200; $y -lt 6100; $y += 4) {
  $s = -1
  for ($x = $X0; $x -lt $X0+$W; $x++) {
    if (IsInk $x $y) { if ($s -lt 0) { $s = $x } }
    elseif ($s -ge 0) {
      $wd = ($x-1) - $s
      if ($wd -gt $bestW) { $bestW = $wd; $centre = [int](($s + ($x-1))/2) }
      $s = -1
    }
  }
}

# ---- trace both sides ----
$penL = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255,255,0,0), 4)
$penC = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180,0,90,255), 3)
$g.DrawLine($penC, ($centre-$X0), 0, ($centre-$X0), $H)

foreach ($side in @(-1,1)) {
  $x = $centre; $started = $false; $prev = $null
  for ($y = $Y0+4; $y -lt $Y0+$H-4; $y += 3) {
    $found = -1
    if (-not $started) {
      for ($d = 2; $d -lt 90; $d++) { $xx = $centre + $side*$d; if (IsInk $xx $y) { $found = $xx; break } }
      if ($found -ge 0) { $started = $true; $x = $found }
    } else {
      for ($d = 0; $d -le 8 -and $found -lt 0; $d++) {
        foreach ($xx in @(($x-$d),($x+$d))) { if (IsInk $xx $y) { $found = $xx; break } }
      }
      if ($found -lt 0) { for ($d = 8; $d -lt 70; $d++) { $xx = $x + $side*$d; if (IsInk $xx $y) { $found = $xx; break } } }
      if ($found -ge 0) { $x = $found }
    }
    if ($started) {
      if ($prev -ne $null) { $g.DrawLine($penL, ($prev.x-$X0), ($prev.y-$Y0), ($x-$X0), ($y-$Y0)) }
      $prev = [pscustomobject]@{ x=$x; y=$y }
    }
  }
  Write-Host ("side {0}: traced to y={1} at x={2}" -f $side, $prev.y, $prev.x)
}
$g.Dispose()
# scale down for viewing
$s = 620/$W; $bw=[int]($W*$s); $bh=[int]($H*$s)
$small = New-Object System.Drawing.Bitmap($bw,$bh)
$g2 = [System.Drawing.Graphics]::FromImage($small)
$g2.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($bmp,0,0,$bw,$bh)
$small.Save($Out,[System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose();$small.Dispose();$bmp.Dispose();$img.Dispose()
Write-Host "centre x = $centre (widest run $bestW px)"
Write-Host "wrote $Out  ${bw}x${bh}"
