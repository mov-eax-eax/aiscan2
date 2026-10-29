# envelope-photo.ps1 — trace the tower's envelope on a high-res PHOTOGRAPH and draw it back.
#
# Why a photograph: Plate I's outline is horizontally exaggerated ~2.3x (it is a
# « diagramme ») and Plate VII's dimension chain is below my reliable reading resolution.
# A photograph is to scale in both axes, so it is the remaining usable measurement source.
#
# DISCIPLINE (learned the hard way in rounds 1-2): draw the result back on the image and
# LOOK at it before believing a single number. Do not tune thresholds against grep output.
#
# Bir-Hakeim is the best candidate: daylight, 4608x3072, tower dark against a blown-out
# white sky, so the threshold is trivial. Its base is behind trees -- expect that and do
# not let the trace walk into them.

Add-Type -AssemblyName System.Drawing

$Src = 'F:\repotest2\eiffel-tower-v3\research\La_Tour_Eiffel_vue_du_Pont_de_Bir_Hakeim.jpeg'
$Out = 'F:\repotest2\eiffel-tower-v4\research\refs\overlay-photo.png'

$img = New-Object System.Drawing.Bitmap($Src)
$W = $img.Width; $H = $img.Height
Write-Host "photo ${W}x${H}"

# ---- centre line: widest dark span in the middle band of the frame ----
$bestW = 0; $centre = [int]($W/2)
for ($y = [int]($H*0.45); $y -lt [int]($H*0.60); $y += 4) {
  $s = -1
  for ($x = 0; $x -lt $W; $x++) {
    $p = $img.GetPixel($x,$y)
    $lum = 0.299*$p.R + 0.587*$p.G + 0.114*$p.B
    if ($lum -lt 190) { if ($s -lt 0) { $s = $x } }
    elseif ($s -ge 0) {
      $wd = ($x-1) - $s
      if ($wd -gt $bestW) { $bestW = $wd; $centre = [int](($s + ($x-1))/2) }
      $s = -1
    }
  }
}
Write-Host "centre x = $centre (widest span $bestW px)"

# ---- trace both outlines ----
$bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, 0, 0, $W, $H)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255,255,0,0), 5)
$penC = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200,0,90,255), 3)
$g.DrawLine($penC, $centre, 0, $centre, $H)

foreach ($side in @(-1,1)) {
  $x = $centre; $started = $false; $prev = $null; $n = 0
  for ($y = 4; $y -lt $H-4; $y += 2) {
    $found = -1
    $win = if ($started) { [Math]::Max(8, [int](0.02*($y))) } else { 3 }
    if (-not $started) {
      for ($d = 2; $d -lt 120; $d++) {
        $xx = $centre + $side*$d
        if ($xx -lt 0 -or $xx -ge $W) { break }
        $p = $img.GetPixel($xx,$y); if ((0.299*$p.R+0.587*$p.G+0.114*$p.B) -lt 190) { $found = $xx; break }
      }
      if ($found -ge 0) { $started = $true; $x = $found }
    } else {
      for ($d = 0; $d -le $win -and $found -lt 0; $d++) {
        foreach ($xx in @(($x-$d),($x+$d))) {
          if ($xx -lt 0 -or $xx -ge $W) { continue }
          $p = $img.GetPixel($xx,$y); if ((0.299*$p.R+0.587*$p.G+0.114*$p.B) -lt 190) { $found = $xx; break }
        }
      }
      if ($found -ge 0) { $x = $found }
    }
    if ($started) {
      if ($prev -ne $null) { $g.DrawLine($pen, $prev.x, $prev.y, $x, $y) }
      $prev = [pscustomobject]@{ x=$x; y=$y }; $n++
    }
  }
  Write-Host ("side {0}: {1} rows, ended y={2} x={3}" -f $side, $n, $prev.y, $prev.x)
}
$g.Dispose()
$s = 620/$W; $bw=[int]($W*$s); $bh=[int]($H*$s)
$small = New-Object System.Drawing.Bitmap($bw,$bh)
$g2 = [System.Drawing.Graphics]::FromImage($small)
$g2.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($bmp,0,0,$bw,$bh)
$small.Save($Out,[System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose();$small.Dispose();$bmp.Dispose();$img.Dispose()
Write-Host "wrote $Out ${bw}x${bh}"
