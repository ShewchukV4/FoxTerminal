param()

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = "FoxTerminal Interface"
$form.Width = 1100
$form.Height = 700
$form.StartPosition = "CenterScreen"
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 18, 24)
$form.ForeColor = [System.Drawing.Color]::Gainsboro

$split = New-Object System.Windows.Forms.SplitContainer
$split.Dock = "Fill"
$split.SplitterDistance = 560
$split.IsSplitterFixed = $false
$split.BackColor = [System.Drawing.Color]::FromArgb(20, 24, 31)
$form.Controls.Add($split)

$consoleTitle = New-Object System.Windows.Forms.Label
$consoleTitle.Text = "FOXTERM CONSOLE"
$consoleTitle.Dock = "Top"
$consoleTitle.Height = 34
$consoleTitle.Padding = New-Object System.Windows.Forms.Padding(10,8,0,0)
$consoleTitle.ForeColor = [System.Drawing.Color]::FromArgb(122,162,247)
$split.Panel1.Controls.Add($consoleTitle)

$output = New-Object System.Windows.Forms.RichTextBox
$output.Dock = "Fill"
$output.ReadOnly = $true
$output.BackColor = [System.Drawing.Color]::FromArgb(10, 12, 16)
$output.ForeColor = [System.Drawing.Color]::WhiteSmoke
$output.BorderStyle = "None"
$output.Font = New-Object System.Drawing.Font("Cascadia Mono", 11)
$output.Text = "FoxTerminal GUI mode`nType 'youtube' and press Enter, or click icon on the right.`n`n"
$split.Panel1.Controls.Add($output)

$inputPanel = New-Object System.Windows.Forms.Panel
$inputPanel.Dock = "Bottom"
$inputPanel.Height = 42
$split.Panel1.Controls.Add($inputPanel)

$input = New-Object System.Windows.Forms.TextBox
$input.Dock = "Fill"
$input.Font = New-Object System.Drawing.Font("Cascadia Mono", 11)
$input.BackColor = [System.Drawing.Color]::FromArgb(20, 24, 31)
$input.ForeColor = [System.Drawing.Color]::WhiteSmoke
$input.BorderStyle = "FixedSingle"
$inputPanel.Controls.Add($input)

$uiTitle = New-Object System.Windows.Forms.Label
$uiTitle.Text = "FOXTERM UI"
$uiTitle.Dock = "Top"
$uiTitle.Height = 34
$uiTitle.Padding = New-Object System.Windows.Forms.Padding(10,8,0,0)
$uiTitle.ForeColor = [System.Drawing.Color]::FromArgb(122,162,247)
$split.Panel2.Controls.Add($uiTitle)

$rightPanel = New-Object System.Windows.Forms.Panel
$rightPanel.Dock = "Fill"
$rightPanel.BackColor = [System.Drawing.Color]::FromArgb(12, 14, 19)
$split.Panel2.Controls.Add($rightPanel)

$ytLabel = New-Object System.Windows.Forms.Label
$ytLabel.Text = "YouTube"
$ytLabel.AutoSize = $false
$ytLabel.TextAlign = "MiddleCenter"
$ytLabel.Dock = "Bottom"
$ytLabel.Height = 36
$ytLabel.ForeColor = [System.Drawing.Color]::White
$ytLabel.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$rightPanel.Controls.Add($ytLabel)

$ytPic = New-Object System.Windows.Forms.PictureBox
$ytPic.Width = 360
$ytPic.Height = 220
$ytPic.SizeMode = "CenterImage"
$ytPic.Cursor = [System.Windows.Forms.Cursors]::Hand
$ytPic.Anchor = "None"
$rightPanel.Controls.Add($ytPic)

function New-YouTubeBitmap {
    param([int]$w = 320, [int]$h = 180)
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(14, 17, 24))

    $rect = New-Object System.Drawing.RectangleF(26, 34, ($w - 52), ($h - 68))
    $radius = 30.0
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
    $path.AddArc($rect.Right - $radius, $rect.Y, $radius, $radius, 270, 90)
    $path.AddArc($rect.Right - $radius, $rect.Bottom - $radius, $radius, $radius, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $radius, $radius, $radius, 90, 90)
    $path.CloseFigure()

    $red = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(229, 45, 39))
    $g.FillPath($red, $path)

    $pts = @(
        (New-Object System.Drawing.PointF(($w/2)-22, ($h/2)-30)),
        (New-Object System.Drawing.PointF(($w/2)-22, ($h/2)+30)),
        (New-Object System.Drawing.PointF(($w/2)+34, ($h/2)))
    )
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 245, 245))
    $g.FillPolygon($white, $pts)

    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 0, 0, 0), 3)
    $g.DrawPath($pen, $path)
    $g.Dispose()
    return $bmp
}

function Append-Log([string]$text) {
    $output.AppendText($text + "`n")
    $output.SelectionStart = $output.TextLength
    $output.ScrollToCaret()
}

function Open-YouTube {
    Append-Log "Opening YouTube..."
    $ytPs1 = Join-Path $PSScriptRoot "youtube.ps1"
    if (Test-Path $ytPs1) {
        Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$ytPs1) | Out-Null
    } else {
        Start-Process "https://www.youtube.com/" | Out-Null
    }
}

$ytPic.Image = New-YouTubeBitmap

$onClick = {
    Open-YouTube
}
$ytPic.Add_Click($onClick)
$ytLabel.Add_Click($onClick)

$input.Add_KeyDown({
    param($sender, $e)
    if ($e.KeyCode -eq [System.Windows.Forms.Keys]::Enter) {
        $cmd = $input.Text.Trim()
        if ([string]::IsNullOrWhiteSpace($cmd)) { return }
        Append-Log ("> " + $cmd)
        $input.Clear()
        $lc = $cmd.ToLowerInvariant()
        if ($lc -eq "youtube" -or $lc -eq "yt" -or $lc -eq "open youtube") {
            Open-YouTube
        } elseif ($lc -eq "clear") {
            $output.Clear()
        } elseif ($lc -eq "help") {
            Append-Log "Commands: youtube | clear | help"
        } else {
            Append-Log "Unknown command. Try: youtube"
        }
        $e.SuppressKeyPress = $true
    }
})

$rightPanel.Add_Resize({
    $ytPic.Left = [Math]::Max(0, ($rightPanel.ClientSize.Width - $ytPic.Width) / 2)
    $ytPic.Top = [Math]::Max(0, ($rightPanel.ClientSize.Height - $ytPic.Height) / 2 - 24)
})

[System.Windows.Forms.Application]::Run($form)
