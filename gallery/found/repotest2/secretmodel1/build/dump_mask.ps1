# Dump a threshold mask as ASCII art so we can SEE what the detector is picking up.
param(
    [string]$Src = "F:\repotest2\secretmodel1\ref\clean_product.jpg",
    [int]$Cols = 100,
    [int]$DarkThreshold = 110
)
Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile($Src)
$W = $Cols
$H = [int][math]::Round($img.Height * $W / $img.Width / 2.1)   # chars are ~2x tall
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$gr = [System.Drawing.Graphics]::FromImage($bmp)
$gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gr.DrawImage($img, 0, 0, $W, $H)
$gr.Dispose(); $img.Dispose()

$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$stride = $data.Stride
$buf = New-Object byte[] ([math]::Abs($stride) * $H)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $buf.Length)
$bmp.UnlockBits($data); $bmp.Dispose()

"SRC: $(Split-Path $Src -Leaf)   size ${W}x${H}   stride=$stride   thresh=$DarkThreshold"
"    " + (0..($W-1) | ForEach-Object { if ($_ % 10 -eq 0) { [string](($_ / 10) % 10) } else { ' ' } }) -join ''
for ($y = 0; $y -lt $H; $y++) {
    $line = New-Object System.Text.StringBuilder
    $row = $y * $stride
    for ($x = 0; $x -lt $W; $x++) {
        $i = $row + $x * 3
        $r = $buf[$i + 2]; $g = $buf[$i + 1]; $b = $buf[$i]
        $lum = (($r * 77) + ($g * 150) + ($b * 29)) -shr 8
        if ($lum -lt $DarkThreshold) { [void]$line.Append('#') } else { [void]$line.Append('.') }
    }
    "{0,3} {1}" -f $y, $line.ToString()
}
