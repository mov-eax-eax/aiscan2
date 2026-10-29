# trace-plate1.ps1 — trace the outline of Fig. 2 on Plate I and emit the profile as JSON.
#
# The plate is « DIAGRAMME DE L'ÉLÉVATION », échelle 0.001 p.m. — orthographic, 1:1000.
# A per-row "outermost dark pixel" scan fails here for the same reason it produced the
# "314 m tower": the dimension chains and margin text flank the figure and the scan walks
# into them. So this TRACES: start at the crown and step down, staying within a small
# window of the previous position.

Add-Type -AssemblyName System.Drawing

$Plate = 'F:\repotest2\eiffel-tower-v3\research\sources\gallica\PL-I-f17-elevation.jpg'
$Out   = 'F:\repotest2\eiffel-tower-v4\verify\plate1-profile.json'

# Fig. 2, located from the 760-wide overview at a factor of 7.84
# The tower is 330 m tall and the drawn height is ~4470 px -> 13.5 px/m, so its BASE must be
# ~1665 px wide. The first region was 1600 px and cut the base off, which made the horizontal
# calibration 2.4x wrong. Size the window from the scale, not from a guess.
$X0 = 1950; $Y0 = 1700; $W = 2700; $H = 4700
$DARK = 150

$img = New-Object System.Drawing.Bitmap($Plate)
Write-Host "plate $($img.Width)x$($img.Height) ; region $X0,$Y0 ${W}x${H}"

function IsInk([int]$x,[int]$y) {
  if ($x -lt $X0 -or $x -ge ($X0+$W) -or $y -lt $Y0 -or $y -ge ($Y0+$H)) { return $false }
  $p = $img.GetPixel($x,$y)
  return (0.299*$p.R + 0.587*$p.G + 0.114*$p.B) -lt $DARK
}

# ---- centre line: from the widest full row in the middle of the shaft ----
# Centre line from the LOWER part of the tower, where it is widest.
# NOT from the middle of the crop: that region holds the caption
# « DIAGRAMME DE L'ELEVATION », and the first version of this script locked onto the
# title text and reported an axis 360 px off -- which then made the two calibration
# scales disagree by 74 %. Locate the subject before measuring it.
# scalars only -- PowerShell flattens `$runs += ,@(a,b)` into a single array and the
# pairs stop being addressable. Same trap that corrupted eiffelTower.js at the start.
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
}Write-Host "centre line x = $centre (widest lower span $bestW px)"

# ---- trace one side downward ----
function Trace([int]$side) {
  $pts = New-Object System.Collections.Generic.List[object]
  $x = $centre; $started = $false
  for ($y = $Y0+4; $y -lt $Y0+$H-4; $y += 2) {
    $found = -1
    if (-not $started) {
      for ($d = 2; $d -lt 70; $d++) {
        $xx = $centre + $side*$d
        if (IsInk $xx $y) { $found = $xx; break }
      }
      if ($found -ge 0) { $started = $true; $x = $found }
    } else {
      for ($d = 0; $d -le 8 -and $found -lt 0; $d++) {
        foreach ($xx in @(($x-$d),($x+$d))) { if (IsInk $xx $y) { $found = $xx; break } }
      }
      if ($found -lt 0) {
        for ($d = 8; $d -lt 60; $d++) {
          $xx = $x + $side*$d
          if (IsInk $xx $y) { $found = $xx; break }
        }
      }
      if ($found -ge 0) { $x = $found }
    }
    if ($started) { $pts.Add([pscustomobject]@{ y=$y; x=$x }) }
  }
  return $pts
}

$left  = Trace -1
$right = Trace  1
Write-Host "traced left $($left.Count) rows, right $($right.Count) rows"
if ($left.Count -eq 0 -or $right.Count -eq 0) { Write-Host "TRACE FAILED"; exit 1 }
Write-Host "  left  y $($left[0].y) .. $($left[$left.Count-1].y)"
Write-Host "  right y $($right[0].y) .. $($right[$right.Count-1].y)"

# ---- calibrate on two independent constraints ----
$topY = [Math]::Min($left[0].y, $right[0].y)
$rmap = @{}; foreach ($q in $right) { $rmap[$q.y] = $q.x }
$widest = 0; $groundY = 0
foreach ($p in $left) {
  if (-not $rmap.ContainsKey($p.y)) { continue }
  $half = [Math]::Abs($rmap[$p.y] - $p.x)/2
  if ($half -gt $widest) { $widest = $half; $groundY = $p.y }
}
$heightPx = $groundY - $topY
$scaleV = 330.0 / $heightPx
$baseWpx = $widest*2
$scaleH = 124.906 / $baseWpx
Write-Host ("top y=$topY  ground y=$groundY  height=$heightPx px")
Write-Host ("  vertical   {0:N4} m/px  ({1:N2} px/m)" -f $scaleV,(1/$scaleV))
Write-Host ("  horizontal {0:N4} m/px  ({1:N2} px/m)" -f $scaleH,(1/$scaleH))
$agree = 100*[Math]::Abs($scaleV-$scaleH)/$scaleV
Write-Host ("  agreement  {0:N2} %" -f $agree)
if ($agree -gt 3) { Write-Host "  *** scales disagree >3% -- region is WRONG, profile not written ***"; exit 2 }

# ---- emit ----
$prof = New-Object System.Collections.Generic.List[object]
foreach ($p in $left) {
  if (-not $rmap.ContainsKey($p.y)) { continue }
  $halfM = ([Math]::Abs($rmap[$p.y] - $p.x)/2) * $scaleH
  $yAGL  = ($groundY - $p.y) * $scaleV
  if ($yAGL -lt 0 -or $yAGL -gt 330) { continue }
  $prof.Add([pscustomobject]@{ y=[Math]::Round($yAGL,3); half=[Math]::Round($halfM,3) })
}
$obj = [pscustomobject]@{ scaleV=$scaleV; scaleH=$scaleH; topY=$topY; groundY=$groundY; profile=$prof }
$obj | ConvertTo-Json -Depth 5 -Compress | Set-Content -Path $Out -Encoding UTF8
Write-Host "wrote $Out : $($prof.Count) rows"
$img.Dispose()
