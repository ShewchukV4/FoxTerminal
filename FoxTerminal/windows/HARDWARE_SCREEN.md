# Залізо і екрани — швидка таблиця (Windows)

Повний текст: [`CURSOR_MEGAGUIDE_UA.md`](CURSOR_MEGAGUIDE_UA.md) §10–12.

## Зняти за 30 секунд

```powershell
Get-CimInstance Win32_Processor | Select Name, NumberOfCores
Get-CimInstance Win32_ComputerSystem | Select @{n='RAM_GB';e={[math]::Round($_.TotalPhysicalMemory/1GB,1)}}
Get-CimInstance Win32_VideoController | Select Name, CurrentHorizontalResolution, CurrentVerticalResolution, CurrentRefreshRate
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
  "$($_.DeviceName) primary=$($_.Primary) $($_.Bounds.Width)x$($_.Bounds.Height) @($($_.Bounds.X),$($_.Bounds.Y))"
}
```

Win+P: **Extend** / Duplicate / PC only / Second only.

## Профілі

| Профіль | Залізо | opacity | blur | shader | cursor | dock |
|---------|--------|---------|------|--------|--------|------|
| Low | слабкий iGPU / ≤8GB | 1.0 | 0 | off | x1 | compact/slim |
| Mid | iGPU / 16GB SSD | 0.92 | 12 | optional | x2 | pill normal |
| High | discrete GPU | 0.92 | 20 | on | x2 | glass normal/large |
| Ultra | strong GPU 32GB+ | 0.92 | 20 | on | x2–x3 | glass large |

## Екран → UI

| Панель | Scale | font | quick% | cursor | dock |
|--------|-------|------|--------|--------|------|
| 1080p laptop | 125–150% | 12–13 | 42–45 | x1–2 | compact |
| 1080p desktop | 100% | 13–14 | 45 | x1–2 | normal |
| 1440p | 100–125% | 13–14 | 45 | x2 | normal/large |
| 4K 27" | 150–200% | 12–13 | 40–45 | x2–3 | large |
| Ultrawide 3440 | 100–125% | 13–14 | **35–40** | x2 | normal; не на весь span |
| Vertical | 100% | 14 | 30–35 | x2 | compact |

## Мультимонітор

1. Primary = Ghostty + foxos rain + dock  
2. Secondary = browser / foxlife + static wall  
3. Різний DPI → cursor/font під **primary**  
4. Duplicate → орієнтуйся на менший спільний режим  
5. Після від’єднання ноута → `foxos apply`

## Після підгонки

```powershell
foxlook export
build after-screen-tune
```
