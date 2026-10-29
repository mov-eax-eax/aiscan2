# envelope-photo3.ps1 — photo envelope by RUN GROUPING.
#
# Rounds 11-12 failed twice:
#   r11  trace from the antenna      -> locked onto the mast (half-width 14 px)
#   r12a seed "widest row" from the  -> found the NEAREST ink (an interior member)
#        centre outward
#   r12b full-row seed               -> span 1907..3739, centre x=2823 while the tower's
#                                       axis is x=2152. It caught the STATUE.
#
# An x-bound cannot fix r12b: the tower's own right edge reaches ~2964 and the statue
# starts ~2900, so they overlap in x. But they are separated by WHITE SKY.
#
# So: group dark runs by GAP. The tower's lattice members are separated by small white
# gaps; the statue is separated from the tower by hundreds of px of blown sky. Merging runs
# with a gap below a threshold groups the tower and excludes the statue -- by construction,
# not by tuning a coordinate.
#
# Then: the group containing the tower axis (or the widest, consistently) is the tower.

Add-Type -AssemblyName System.Drawing
$Src='F:\repotest2\eiffel-tower-v3\research\La_Tour_Eiffel_vue_du_Pont_de_Bir_Hakeim.jpeg'
$Out='F:\repotest2\eiffel-tower-v4\research\refs\overlay-photo3.png'
$img=New-Object System.Drawing.Bitmap($Src); $W=$img.Width; $H=$img.Height
$AXIS=2152; $GAP=170      # px of white sky that separates the tower from a neighbour

function Runs($y) {
  $runs=New-Object System.Collections.Generic.List[object]
  $s=-1
  for ($x=0; $x -lt $W; $x++) {
    $p=$img.GetPixel($x,$y); $lum=0.299*$p.R+0.587*$p.G+0.114*$p.B
    if ($lum -lt 190) { if ($s -lt 0) { $s=$x } }
    elseif ($s -ge 0) { $runs.Add([pscustomobject]@{a=$s;b=$x-1}); $s=-1 }
  }
  if ($s -ge 0) { $runs.Add([pscustomobject]@{a=$s;b=$W-1}) }
  return $runs
}

function TowerSpan($y) {
  $runs = Runs $y
  if ($runs.Count -eq 0) { return $null }
  # merge runs separated by less than GAP
  $groups=New-Object System.Collections.Generic.List[object]
  $ca=$runs[0].a; $cb=$runs[0].b
  for ($i=1; $i -lt $runs.Count; $i++) {
    if ($runs[$i].a - $cb -lt $GAP) { $cb=$runs[$i].b }
    else { $groups.Add([pscustomobject]@{a=$ca;b=$cb}); $ca=$runs[$i].a; $cb=$runs[$i].b }
  }
  $groups.Add([pscustomobject]@{a=$ca;b=$cb})
  # the tower is the group whose span contains the axis, else the widest
  $pick=$null
  foreach ($grp in $groups) { if ($grp.a -le $AXIS -and $grp.b -ge $AXIS) { $pick=$grp; break } }
  if ($pick -eq $null) { foreach ($grp in $groups) { if ($pick -eq $null -or ($grp.b-$grp.a) -gt ($pick.b-$pick.a)) { $pick=$grp } } }
  return $pick
}

# ---- trace every row in the region above the treeline ----
$rows=New-Object System.Collections.Generic.List[object]
for ($y=60; $y -lt 2650; $y+=2) {
  $sp = TowerSpan $y
  if ($sp -ne $null) { $rows.Add([pscustomobject]@{y=$y; l=$sp.a; r=$sp.b; hw=($sp.b-$sp.a)/2}) }
}
Write-Host "rows with a tower span: $($rows.Count)"
$first=$rows[0]; $last=$rows[$rows.Count-1]
Write-Host ("  y {0} .. {1}" -f $first.y,$last.y)
Write-Host ("  half-width {0} px at top -> {1} px at bottom" -f [int]$first.hw,[int]$last.hw)

# ---- CALIBRATION FIRST, before looking -----------------------------------------
# two known heights: antenna tip (330 m) and the widest row (the 2nd platform if the
# trace is right). Compare the two implied scales; they must agree.
$widest=$rows[0]; foreach ($r in $rows) { if ($r.hw -gt $widest.hw) { $widest=$r } }
Write-Host ("  widest half-width {0} px at row {1}" -f [int]$widest.hw,$widest.y)
$sHeight = 330.0/($last.y-$first.y)                       # m/px assuming full height in frame
$sWidth  = 40.96/(2*$widest.hw)                           # m/px assuming widest = 2nd platform
Write-Host ("  scale from HEIGHT  : {0:N4} m/px" -f $sHeight)
Write-Host ("  scale from WIDTH   : {0:N4} m/px" -f $sWidth)
$agree = 100*[Math]::Abs($sHeight-$sWidth)/$sHeight
Write-Host ("  agreement          : {0:N1} %" -f $agree)
if ($agree -gt 8) { Write-Host "  *** disagree -- trace still wrong, do not use ***" }

# ---- overlay at 50 % so an axis-hugging fault CANNOT hide ----------------------
$bmp=New-Object System.Drawing.Bitmap($W,$H,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g=[System.Drawing.Graphics]::FromImage($bmp); $g.DrawImage($img,0,0,$W,$H)
$pen=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255,255,0,0),6)
foreach ($r in $rows) { $g.DrawLine($pen,$r.l,$r.y,$r.r,$r.y) }
$g.Dispose()
$cx=1100; $cy=100; $cw=2200; $ch=2200
$s=0.5; $bw=[int]($cw*$s); $bh=[int]($ch*$s)
$sm=New-Object System.Drawing.Bitmap($bw,$bh)
$g2=[System.Drawing.Graphics]::FromImage($sm)
$g2.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($bmp,(New-Object System.Drawing.Rectangle(0,0,$bw,$bh)),(New-Object System.Drawing.Rectangle($cx,$cy,$cw,$ch)),[System.Drawing.GraphicsUnit]::Pixel)
$sm.Save($Out,[System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose();$sm.Dispose();$bmp.Dispose();$img.Dispose()
Write-Host "wrote $Out ${bw}x${bh}"
