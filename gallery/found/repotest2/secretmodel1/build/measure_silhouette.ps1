# Measure the Xbox controller silhouette from a top-down reference photo.
# Strategy: the controller is very dark; the background is light with speckles.
# For each image row, find the LONGEST run of dark pixels -> that is the body,
# which is robust against isolated dark speckles in the background.
param(
    [string]$Src = "F:\repotest2\secretmodel1\ref\Xbox_Series_Controller_Carbon_Black.jpg",
    [int]$Width = 640,
    [int]$DarkThreshold = 95,
    [int]$Samples = 26
)

Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile($Src)
$W = $Width
$H = [int][math]::Round($img.Height * $W / $img.Width)
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$gr = [System.Drawing.Graphics]::FromImage($bmp)
$gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gr.DrawImage($img, 0, 0, $W, $H)
$gr.Dispose(); $img.Dispose()

$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$stride = $data.Stride
$buf = New-Object byte[] ($stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $buf.Length)
$bmp.UnlockBits($data)
$bmp.Dispose()

# Precompute luminance per pixel (BGR order in 24bppRgb)
$lum = New-Object 'int[,]' $W, $H
for ($y = 0; $y -lt $H; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $W; $x++) {
        $i = $row + $x * 3
        # integer luma approximation
        $lum[$x, $y] = (($buf[$i + 2] * 77) + ($buf[$i + 1] * 150) + ($buf[$i] * 29)) -shr 8
    }
}

# Longest dark run per row
$runL = New-Object 'int[]' $H
$runR = New-Object 'int[]' $H
$runLen = New-Object 'int[]' $H
for ($y = 0; $y -lt $H; $y++) {
    $best = 0; $bestS = -1; $bestE = -1
    $cur = 0; $curS = -1
    for ($x = 0; $x -lt $W; $x++) {
        if ($lum[$x, $y] -lt $DarkThreshold) {
            if ($cur -eq 0) { $curS = $x }
            $cur++
            if ($cur -gt $best) { $best = $cur; $bestS = $curS; $bestE = $x }
        } else { $cur = 0 }
    }
    $runL[$y] = $bestS; $runR[$y] = $bestE; $runLen[$y] = $best
}

# Ignore sliver rows; require a meaningful run to count as "body present"
$minRun = [int]($W * 0.06)
$top = -1; $bot = -1
for ($y = 0; $y -lt $H; $y++) { if ($runLen[$y] -ge $minRun) { if ($top -lt 0) { $top = $y }; $bot = $y } }

$maxLen = 0
for ($y = $top; $y -le $bot; $y++) { if ($runLen[$y] -gt $maxLen) { $maxLen = $runLen[$y] } }

"Image            : {0}x{1} (from {2})" -f $W, $H, (Split-Path $Src -Leaf)
"Body rows        : y={0}..{1}  ({2} px tall)" -f $top, $bot, ($bot - $top + 1)
"Widest run       : {0} px" -f $maxLen
""
"Real-world target: 152.9 mm wide x 101.9 mm deep (aspect {0:N3})" -f (152.9 / 101.9)
"Measured aspect  : {0:N3}" -f ($maxLen / ($bot - $top + 1))
""
"--- Half-width profile (normalised: y=0 front/bottom grip tip .. y=1 top) ---"
"  t(y)     xL      xR    width   width/W   centre"
$cx = 0.0
for ($s = 0; $s -lt $Samples; $s++) {
    $t = $s / ($Samples - 1)
    $y = [int][math]::Round($bot - $t * ($bot - $top))
    $wl = $runL[$y]; $wr = $runR[$y]; $len = $runLen[$y]
    $c = ($wl + $wr) / 2.0
    "{0,6:N3} {1,6} {2,7} {3,7}  {4,7:N3}  {5,8:N1}" -f $t, $wl, $wr, $len, ($len / $maxLen), $c
}
