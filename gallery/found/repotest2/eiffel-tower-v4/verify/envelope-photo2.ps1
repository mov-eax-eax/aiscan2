# envelope-photo2.ps1 — corrected photo envelope trace.
#
# ROUND 11 FAULT: the trace started at the antenna and never left it, so the half-widths
# were ~14 px where the tower's shaft is 150+ px. It locked onto the mast.
#
# FIX: seed on a WIDE row, on the silhouette EDGE, then contour-trace both up and down.
# Plus a hard gate: the half-width must grow monotonically toward the base. If it does not,
# the trace is wrong and nothing downstream may use it.
#
# ORDER OF OPERATIONS (corrected in round 11): run the NUMERIC calibration BEFORE any
# visual check. The 620x413 overlay looked fine while the trace was broken; the number
# caught it in one line.

Add-Type -AssemblyName System.Drawing
$Src='F:\repotest2\eiffel-tower-v3\research\La_Tour_Eiffel_vue_du_Pont_de_Bir_Hakeim.jpeg'
$Out='F:\repotest2\eiffel-tower-v4\research\refs\overlay-photo2.png'
$img=New-Object System.Drawing.Bitmap($Src); $W=$img.Width; $H=$img.Height
function Ink($x,$y){ if($x -lt 0 -or $x -ge $W -or $y -lt 0 -or $y -ge $H){return $false}; $p=$img.GetPixel($x,$y); return ((0.299*$p.R+0.587*$p.G+0.114*$p.B) -lt 190) }

# ---- 1. SEED: scan the FULL row in a clean band -------------------------------
# Round 12 first attempt failed again: walking outward from the centre finds the NEAREST
# ink, which is an interior lattice member, not the silhouette edge (seed width 19 px
# where the shaft is 300+ px).
#
# Correct method: pick rows where the TOWER IS THE ONLY DARK THING -- above the treeline
# (trees start ~y 2700) and clear of the statue (x ~2900-3600, y ~2400+). In that band a
# full-row scan for dark pixels gives the tower's true extent directly.
$best=0; $seedY=0; $seedL=0; $seedR=0
for ($y=500; $y -lt 2300; $y+=5) {
  $l=-1; $r=-1
  for ($x=200; $x -lt ($W-200); $x++) {
    if (Ink $x $y) { if ($l -lt 0) { $l=$x }; $r=$x }
  }
  if ($l -ge 0 -and ($r-$l) -gt $best) { $best=$r-$l; $seedY=$y; $seedL=$l; $seedR=$r }
}
Write-Host "seed row $seedY : full-row edges $seedL .. $seedR  (width $best px)"
# ---- 2. contour-trace from the seed, outward ----
function TraceDir([int]$side,[int]$fromY,[int]$step) {
  $pts=New-Object System.Collections.Generic.List[object]
  $x = if ($side -lt 0) { $seedL } else { $seedR }
  for ($y=$fromY; $y -gt 4 -and $y -lt $H-4; $y+=$step) {
    $found=-1
    $win=[Math]::Max(10,[int](0.03*[Math]::Abs($y-$seedY))+10)
    for ($d=0; $d -le $win -and $found -lt 0; $d++) {
      foreach ($xx in @(($x-$d),($x+$d))) { if (Ink $xx $y) { $found=$xx; break } }
    }
    if ($found -lt 0) { for ($d=$win; $d -lt $win+90; $d++) { $xx=$x+$side*$d; if (Ink $xx $y) { $found=$xx; break } } }
    if ($found -ge 0) { $x=$found }
    $pts.Add([pscustomobject]@{ y=$y; x=$x })
  }
  return $pts
}
$lUp=TraceDir -1 $seedY -2; $rUp=TraceDir 1 $seedY -2
$lDn=TraceDir -1 $seedY  2; $rDn=TraceDir 1 $seedY  2
Write-Host "up: $($lUp.Count)+$($rUp.Count) rows   down: $($lDn.Count)+$($rDn.Count) rows"

# ---- 3. GATE: half-width must grow monotonically toward the base ----
$map=@{}
foreach ($p in $lDn) { if(-not $map.ContainsKey($p.y)){$map[$p.y]=@{}}; $map[$p.y][-1]=$p.x }
foreach ($p in $rDn) { if(-not $map.ContainsKey($p.y)){$map[$p.y]=@{}}; $map[$p.y][1]=$p.x }
$hw=@{}; foreach ($y in ($map.Keys|Sort-Object)) { if($map[$y].ContainsKey(-1) -and $map[$y].ContainsKey(1)){ $hw[$y]=($map[$y][1]-$map[$y][-1])/2 } }
$ys=@($hw.Keys|Sort-Object)
$viol=0; $prev=-1
foreach ($y in $ys) { if ($hw[$y] -lt $prev-3) { $viol++ }; $prev=$hw[$y] }
Write-Host ("down-trace: {0} rows, half-width {1} .. {2} px, monotonicity violations {3}" -f $ys.Count, $hw[$ys[0]], $hw[$ys[-1]], $viol)

# ---- 4. NUMERIC CALIBRATION FIRST: two known heights ----
$yAntenna = $lUp[$lUp.Count-1].y
$widestY = $ys[-1]
Write-Host "antenna row $yAntenna ; widest down-trace row $widestY (half-width $($hw[$widestY]) px)"
Write-Host "  if that widest row is the 2nd platform (40.96 m): scale = $([Math]::Round(40.96/(2*$hw[$widestY]),4)) m/px"
Write-Host "  expected order of magnitude: ~0.07 m/px (13 px/m). If far off, the trace is still wrong."

# ---- 5. overlay, at a scale that can show an axis-hugging fault ----
$bmp=New-Object System.Drawing.Bitmap($W,$H,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g=[System.Drawing.Graphics]::FromImage($bmp); $g.DrawImage($img,0,0,$W,$H)
$p1=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255,255,0,0),7)
$p2=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255,0,140,255),4)
foreach ($set in @($lUp,$rUp,$lDn,$rDn)) { for($i=1;$i -lt $set.Count;$i++){ $g.DrawLine($p1,$set[$i-1].x,$set[$i-1].y,$set[$i].x,$set[$i].y) } }
$g.DrawLine($p2,$seedL,$seedY,$seedR,$seedY)
$g.Dispose()
# crop around the lower tower and render at 50 % -- big enough to expose a fault
$cx=1900; $cy=[int]($seedY-1200); $cw=1900; $ch=1900
$s=0.5; $bw=[int]($cw*$s); $bh=[int]($ch*$s)
$sm=New-Object System.Drawing.Bitmap($bw,$bh)
$g2=[System.Drawing.Graphics]::FromImage($sm)
$g2.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($bmp,(New-Object System.Drawing.Rectangle(0,0,$bw,$bh)),(New-Object System.Drawing.Rectangle($cx,$cy,$cw,$ch)),[System.Drawing.GraphicsUnit]::Pixel)
$sm.Save($Out,[System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose();$sm.Dispose();$bmp.Dispose();$img.Dispose()
Write-Host "wrote $Out (50% crop) ${bw}x${bh}"
