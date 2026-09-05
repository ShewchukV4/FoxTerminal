param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

function Show-Usage {
    Write-Host "Usage: friend [--model <name>] [--system <text>] [--max <n>] [--ctx <n>] [--keepalive <time>] [--stream|--no-stream]"
    Write-Host "In-chat: exitt (exit) | /clear | /help | /model | /cmds | /repo | /read <path> | /explain <path>"
    Write-Host "Open shortcuts: ask naturally (e.g. 'can you open youtube music ui?') (runs command and exits)"
    Write-Host "Env: OLLAMA_URL, FOXTERM_OLLAMA_MODEL (default gemma3:1b), FOXTERM_OLLAMA_SYSTEM, FOXTERM_OLLAMA_KEEP_ALIVE, FOXTERM_FRIEND_MAX_TURNS (default 25)"
}

# "Open X" triggers: English only. Use explicit commands to avoid accidental matches.
$openTriggers = @(
    # Browsers / apps
    @{ patterns = @("open youtube", "youtube"); script = "youtube"; args = @() },
    @{ patterns = @("open spotify", "spotify", "sp"); script = "sp"; args = @() },
    @{ patterns = @(
            "open spotify ui", "spotify ui",
            "open spotify dj", "spotify dj",
            "sp-ui", "open sp-ui",
            "sp ui", "open sp ui"
        ); script = "sp-ui"; args = @() },
    @{ patterns = @("open youtube music", "youtube music", "ytm"); script = "ytm"; args = @() },
    @{ patterns = @("open youtube music ui", "youtube music ui", "open ytm ui", "ytm ui", "ytm-ui", "open ytm-ui"); script = "ytm-ui"; args = @() },
    @{ patterns = @("open telegram", "telegram", "tg"); script = "tg"; args = @() },
    @{ patterns = @("open notes", "notes", "note", "wai"); script = "wai"; args = @() },

    # Quick utilities
    @{ patterns = @("open weather", "weather"); script = "weather"; args = @() },
    @{ patterns = @("open ip", "ip"); script = "ip"; args = @() },
    @{ patterns = @("open wifi", "wifi"); script = "wifi"; args = @() },
    @{ patterns = @("open disk", "disk"); script = "disk"; args = @() },
    @{ patterns = @("open fday", "fday", "day"); script = "fday"; args = @() },
    @{ patterns = @("open foxhelp", "foxhelp"); script = "foxhelp"; args = @() }
)

function Normalize-OpenText([string]$text) {
    if ($null -eq $text) { return "" }
    $n = $text.Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($n)) { return "" }

    # Replace punctuation with spaces, collapse whitespace.
    $n = $n -replace '[^\p{L}\p{Nd}\s]+', ' '
    $n = $n -replace "\s+", " "
    $n = $n.Trim()

    # Drop leading filler words to make "hello open ..." work without matching random text.
    $stop = @("hi","hello","hey","pls","please","yo","ok","okay","can","could","would","will","you","friend","frederik")
    $parts = @($n -split ' ')
    $i = 0
    while ($i -lt $parts.Count -and ($stop -contains $parts[$i])) { $i++ }
    if ($i -gt 0 -and $i -lt $parts.Count) {
        $n = ($parts[$i..($parts.Count - 1)] -join " ").Trim()
    } elseif ($i -ge $parts.Count) {
        $n = ""
    }

    return $n
}

function Get-NormalizedTokens([string]$text) {
    $n = Normalize-OpenText $text
    if ([string]::IsNullOrWhiteSpace($n)) { return @() }
    return @($n -split ' ' | Where-Object { $_ -ne "" })
}

function Test-AnyTokenLike([string[]]$tokens, [string[]]$needles) {
    if ($null -eq $tokens -or $tokens.Count -eq 0) { return $false }
    foreach ($t in $tokens) {
        foreach ($n in $needles) {
            if ([string]::IsNullOrWhiteSpace($n)) { continue }
            # Allow prefix-ish matching to handle typos: youtub, spotif, telegr...
            if ($t -eq $n) { return $true }
            if ($t.StartsWith($n)) { return $true }
            if ($n.Length -ge 4 -and $t.Length -ge 4) {
                # Also accept both being close prefixes (common in missing last letters)
                $min = [Math]::Min($t.Length, $n.Length)
                if ($min -ge 4) {
                    $tp = $t.Substring(0, $min)
                    $np = $n.Substring(0, $min)
                    if ($tp -eq $np) { return $true }
                }
            }
        }
    }
    return $false
}

function Get-RemainingQueryTokens([string[]]$tokens, [string[]]$removePrefixes) {
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($t in $tokens) {
        $drop = $false
        foreach ($r in $removePrefixes) {
            if ([string]::IsNullOrWhiteSpace($r)) { continue }
            if ($t -eq $r -or $t.StartsWith($r)) { $drop = $true; break }
        }
        if (-not $drop) { $out.Add($t) | Out-Null }
    }
    return $out.ToArray()
}

function Try-RouteCommandByKeywords([string]$userInput) {
    # Goal: natural language -> command without exact phrases.
    $tokens = Get-NormalizedTokens $userInput
    if ($tokens.Count -eq 0) { return $null }

    # If user is clearly chatting, do not route.
    if ($tokens.Count -ge 6 -and -not (Test-AnyTokenLike $tokens @("open","start","launch","run","go","show"))) { return $null }

    $openIntent = Test-AnyTokenLike $tokens @("open","start","launch","run","go","show")

    # Service keywords
    $isYouTube  = Test-AnyTokenLike $tokens @("youtube","youtub","yt")
    $isMusic    = Test-AnyTokenLike $tokens @("music","ytm")
    $isSpotify  = Test-AnyTokenLike $tokens @("spotify","spotif","sp")
    $isTelegram = Test-AnyTokenLike $tokens @("telegram","telegr","tg")
    $isNotes    = Test-AnyTokenLike $tokens @("notes","note")
    $isHelp     = Test-AnyTokenLike $tokens @("foxhelp","help")
    $isWeather  = Test-AnyTokenLike $tokens @("weather","wttr")
    $isIp       = Test-AnyTokenLike $tokens @("ip")
    $isWifi     = Test-AnyTokenLike $tokens @("wifi","wi-fi")
    $isDisk     = Test-AnyTokenLike $tokens @("disk","drive","storage")
    $isDay      = Test-AnyTokenLike $tokens @("fday","day","today")
    $isSearch   = Test-AnyTokenLike $tokens @("search","google")
    $isChatGpt  = Test-AnyTokenLike $tokens @("chatgpt","gpt")
    $wantsUi    = Test-AnyTokenLike $tokens @("ui","dj","control","controls","tui")

    # Build query leftovers (best-effort)
    $remove = @("open","start","launch","run","go","show","please","pls","for","me","a","an","the","to")
    $remove += @("youtube","youtub","yt","music","ytm","spotify","spotif","sp","telegram","telegr","tg","notes","note","foxhelp","help","weather","wttr","ip","wifi","disk","drive","storage","fday","day","today","search","google","chatgpt","gpt","ui","dj","control","controls","tui")
    $qTokens = Get-RemainingQueryTokens $tokens $remove
    $query = ($qTokens -join " ").Trim()

    # Route decisions (prefer the most specific)
    if ($isHelp -and ($openIntent -or $tokens.Count -le 3)) { return @{ script = "foxhelp"; args = @() } }
    if ($isNotes -and ($openIntent -or $tokens.Count -le 3)) { return @{ script = "wai"; args = @() } }
    if ($isTelegram -and ($openIntent -or $tokens.Count -le 3)) {
        return @{ script = "tg"; args = if ([string]::IsNullOrWhiteSpace($query)) { @() } else { @($query) } }
    }

    if ($isSpotify -and ($openIntent -or $tokens.Count -le 3)) {
        if ($wantsUi) { return @{ script = "sp-ui"; args = @() } }
        return @{ script = "sp"; args = if ([string]::IsNullOrWhiteSpace($query)) { @() } else { @($query) } }
    }

    if ($isYouTube -and ($openIntent -or $tokens.Count -le 4)) {
        if ($isMusic) {
            if ($wantsUi) { return @{ script = "ytm-ui"; args = @() } }
            return @{ script = "ytm"; args = if ([string]::IsNullOrWhiteSpace($query)) { @() } else { @($query) } }
        }
        # regular YouTube: if user gave query, search; else open home
        if (-not [string]::IsNullOrWhiteSpace($query)) { return @{ script = "yt"; args = @($query) } }
        return @{ script = "youtube"; args = @() }
    }

    if ($isWeather -and ($openIntent -or $tokens.Count -le 3)) { return @{ script = "weather"; args = if ([string]::IsNullOrWhiteSpace($query)) { @() } else { @($query) } } }
    if ($isIp -and ($openIntent -or $tokens.Count -le 2)) { return @{ script = "ip"; args = @() } }
    if ($isWifi -and ($openIntent -or $tokens.Count -le 3)) { return @{ script = "wifi"; args = @() } }
    if ($isDisk -and ($openIntent -or $tokens.Count -le 3)) { return @{ script = "disk"; args = @() } }
    if ($isDay -and ($openIntent -or $tokens.Count -le 3)) { return @{ script = "fday"; args = if ([string]::IsNullOrWhiteSpace($query)) { @() } else { @($query) } } }

    if ($isSearch -and ($openIntent -or $tokens.Count -le 4)) {
        if (-not [string]::IsNullOrWhiteSpace($query)) { return @{ script = "ser"; args = @($query) } }
        return @{ script = "ser"; args = @("google") }
    }
    if ($isChatGpt -and ($openIntent -or $tokens.Count -le 4)) {
        if (-not [string]::IsNullOrWhiteSpace($query)) { return @{ script = "gask"; args = @($query) } }
        return @{ script = "gask"; args = @("hello") }
    }

    return $null
}

function Resolve-OpenCommand([string]$userInput) {
    $raw = $userInput.Trim()
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    $n = Normalize-OpenText $raw
    if ([string]::IsNullOrWhiteSpace($n)) { return $null }
    $nNoSpaces = $n -replace "\s", ""

    # Pick the "best" match (prefer exact + longer phrase) so that:
    # - "open youtube music ui" matches ytm-ui, not youtube
    # - "open youtube music" matches ytm, not youtube
    $best = $null
    $bestScore = -1

    foreach ($row in $openTriggers) {
        foreach ($p in $row.patterns) {
            $pNorm = Normalize-OpenText $p
            if ([string]::IsNullOrWhiteSpace($pNorm)) { continue }
            $pNoSpaces = $pNorm -replace "\s", ""
            $isSingleWord = ($pNorm -notmatch '\s')

            $matchType = 0  # 0=no, 1=contains, 2=boundary, 3=exact
            if ($n -eq $pNorm -or $nNoSpaces -eq $pNoSpaces) {
                $matchType = 3
            } elseif (-not $isSingleWord) {
                # Multi-word phrases can appear inside short sentences.
                if ($n.StartsWith($pNorm + " ") -or $n.EndsWith(" " + $pNorm) -or $n.Contains(" " + $pNorm + " ")) {
                    $matchType = 2
                } elseif ($n.Contains($pNorm)) {
                    $matchType = 1
                }
            } else {
                # Single-word triggers must be exact (avoid accidental matches like "I like youtube").
                $matchType = 0
            }

            if ($matchType -gt 0) {
                $phraseLen = $pNorm.Length
                $wordCount = (@($pNorm -split ' ') | Where-Object { $_ -ne "" }).Count
                # Score components: exactness first, then more specific/longer phrases.
                $score = ($matchType * 100000) + ($wordCount * 1000) + $phraseLen
                if ($score -gt $bestScore) {
                    $bestScore = $score
                    $best = @{ script = $row.script; args = $row.args }
                }
            }
        }
    }

    return $best
}

function Ensure-Utf8Console {
    try {
        $chcp = Get-Command chcp -ErrorAction SilentlyContinue
        if ($chcp) { $null = & chcp 65001 2>$null }
        $utf8 = [System.Text.UTF8Encoding]::new($false)
        [Console]::OutputEncoding = $utf8
        [Console]::InputEncoding = $utf8
        $global:OutputEncoding = $utf8
    } catch { }
}

Ensure-Utf8Console

$model = if ($env:FOXTERM_OLLAMA_MODEL) { $env:FOXTERM_OLLAMA_MODEL } else { "gemma3:1b" }
$system = if ($env:FOXTERM_OLLAMA_SYSTEM) {
    $env:FOXTERM_OLLAMA_SYSTEM
} else {
    @"
You are Frederik Endiscot (FRIEND), a FoxTerminal assistant.

Rules:
- Reply in English only.
- Be concise in the terminal: short paragraphs, use lists or code blocks when helpful. Avoid long preambles.
- You help with shell commands, scripts (PowerShell, batch, bash), and general questions. Prefer safe, cross-platform advice when possible.
- If the user asks for code, give runnable snippets. If they ask to explain something, be clear and step-by-step.
- You cannot access the repo/files by default. Only when the user uses FRIEND chat commands like /explain <path> (the script will provide file contents).
- Stay in character as FRIEND: friendly, competent, a bit dry. No moralizing unless asked.

FoxTerminal command map (high-level):
- foxhelp: interactive help menu (shows all commands from cmd\)
- friend: this chat assistant
- ask "...": one-shot AI via Ollama (optional: --image <path>)
- ff open <alias|url>: open sites in Firefox (aliases via bbind/blist/bdel)
- youtube / yt <q>: open YouTube / search
- sp / sp-ui: Spotify open / DJ controls UI
- ytm / ytm-ui: YouTube Music open / DJ controls UI
- tg / tgub / tglist: Telegram open + bindings
- wai / go / nfile / edit / fdel: notes files (no note command; use wai to see folder)
- weather / ip / wifi / fday: quick status

Writing to Notes (files in FoxTerminal notes folder):
- When the user asks to create a file in notes, or to write/save something to a file (e.g. "make a file AIfile.txt", "write this to notes", "save to file X"), do this:
  1) If it's not clear, ask: "Which filename? (e.g. AIfile.txt or folder/file.txt)" and "Should I write it in my own words or use your exact text?"
  2) When you have the filename and content:
     - If the user said "exactly as I wrote", "my exact words", "quote me", or pasted text to save: use that text exactly.
     - If they asked you to summarize, explain, or "in your own words": generate the content yourself.
  3) To actually write the file, output on the first line exactly: [WRITE_NOTE]filename.txt
     (e.g. [WRITE_NOTE]AIfile.txt or [WRITE_NOTE]test/myfile.txt). Then on the next line start the content. Put the full content in your reply; the tool will save everything after that first line into the file. Do not add [WRITE_NOTE] unless the user has asked to create/write to a file and you have the filename and content ready.
- Only use [WRITE_NOTE] when the user clearly asked to create or write to a file in notes. Never use it for general advice.
- NEVER output [WRITE_NOTE] for "open ..." shortcuts (YouTube/Spotify/YTM/Telegram/Notes). Those should run commands, not write files.
"@
}
$keepAlive = if ($env:FOXTERM_OLLAMA_KEEP_ALIVE) { $env:FOXTERM_OLLAMA_KEEP_ALIVE } else { "10m" }
$numPredict = $null
$numCtx = $null
$stream = $true
# Keep last N message pairs (user+assistant) to avoid context overflow; system always kept
$maxTurns = if ($env:FOXTERM_FRIEND_MAX_TURNS) { [int]$env:FOXTERM_FRIEND_MAX_TURNS } else { 25 }
$requestTimeoutMs = 300000
$maxRetries = 1

for ($i = 0; $i -lt $Args.Count; $i++) {
    $arg = $Args[$i]
    switch ($arg) {
        { $_ -in @("--model", "-m") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing model name."; exit 1 }
            $model = $Args[$i + 1]
            $i++
        }
        { $_ -in @("--system", "-s") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing system prompt text."; exit 1 }
            $system = $Args[$i + 1]
            $i++
        }
        { $_ -in @("--max") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing max tokens."; exit 1 }
            $numPredict = [int]$Args[$i + 1]
            $i++
        }
        { $_ -in @("--ctx") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing context size."; exit 1 }
            $numCtx = [int]$Args[$i + 1]
            $i++
        }
        { $_ -in @("--keepalive") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing keepalive value."; exit 1 }
            $keepAlive = $Args[$i + 1]
            $i++
        }
        { $_ -in @("--stream") } {
            $stream = $true
        }
        { $_ -in @("--no-stream") } {
            $stream = $false
        }
        { $_ -in @("--help", "-h", "/?") } {
            Show-Usage
            exit 0
        }
        default {
            Write-Host "Unknown argument: $arg"
            Show-Usage
            exit 1
        }
    }
}

$baseUrl = if ($env:OLLAMA_URL) { $env:OLLAMA_URL } else { "http://localhost:11434" }
$url = $baseUrl.TrimEnd("/") + "/api/chat"

function Get-ModelsRoot {
    if ($env:OLLAMA_MODELS) { return $env:OLLAMA_MODELS }
    return (Join-Path $env:USERPROFILE ".ollama\models")
}

function Test-ModelExists([string]$modelName) {
    $root = Get-ModelsRoot
    $manifests = Join-Path $root "manifests"
    if (-not (Test-Path $manifests)) { return $false }
    $name = $modelName
    $tag = $null
    if ($modelName -match "^(.*):([^:]+)$") {
        $name = $matches[1]
        $tag = $matches[2]
    } else {
        $tag = "latest"
    }
    $pattern = "\\$([Regex]::Escape($name))\\$([Regex]::Escape($tag))$"
    $hit = Get-ChildItem -Path $manifests -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match $pattern } |
        Select-Object -First 1
    return ($null -ne $hit)
}

if ($baseUrl -match "localhost|127\.0\.0\.1") {
    if (-not (Test-ModelExists $model)) {
        $root = Get-ModelsRoot
        Write-Host "Model not found in: $root"
        Write-Host "Download it (if Ollama is installed):"
        Write-Host "  & `"C:\Program Files\Ollama\ollama.exe`" pull $model"
        exit 1
    }
}

function Trim-MessageHistory {
    param([System.Collections.Generic.List[hashtable]]$msgList, [int]$maxPairs)
    # Keep system (index 0) + last maxPairs user/assistant pairs
    $toKeep = 1 + 2 * $maxPairs
    while ($msgList.Count -gt $toKeep) {
        $msgList.RemoveAt(1)
    }
}

function Parse-WriteNote([string]$reply) {
    if ($reply -notmatch '\[WRITE_NOTE\]([^\r\n]+)') { return $null }
    $filename = $matches[1].Trim()
    # If the model mistakenly outputs a full sentence, try to extract the last *.txt token
    if ($filename -match '\s') {
        $tokens = $filename -split '\s+'
        $txtTok = $tokens | Where-Object { $_ -match '(?i)\.txt$' } | Select-Object -Last 1
        if ($txtTok) { $filename = $txtTok }
    }

    function Sanitize-NoteRelPath([string]$p) {
        if ([string]::IsNullOrWhiteSpace($p)) { return "" }
        $p = $p.Trim()
        # Remove wrappers that often appear in model outputs.
        $p = $p -replace '```', ''
        $p = $p -replace '^\[+|\]+$', ''
        $p = $p -replace '^\s+|\s+$', ''

        # Normalize separators and split.
        $p = $p -replace '^[/\\]+', ''
        $parts = @($p -split '[\\/]+') | Where-Object { $_ -and $_ -ne "." -and $_ -ne ".." }
        $safeParts = New-Object System.Collections.Generic.List[string]
        foreach ($seg in $parts) {
            $s = $seg.Trim()
            if ([string]::IsNullOrWhiteSpace($s)) { continue }
            # Sanitize for Windows filenames (also avoid weird bracket paths like AIfile.txt/[AIfile.txt])
            $s = $s -replace '[<>:"|?*]', '_'  # invalid on Windows
            $s = $s -replace '[\[\]]', '_'     # prevent accidental "[file]" segments
            $s = $s.Trim().TrimEnd('.')
            if ([string]::IsNullOrWhiteSpace($s)) { continue }
            $safeParts.Add($s) | Out-Null
        }
        return ($safeParts.ToArray() -join "\")
    }

    $filename = Sanitize-NoteRelPath $filename
    if ([string]::IsNullOrWhiteSpace($filename)) { return $null }
    if ($filename -notmatch '(?i)\.txt$') { $filename += '.txt' }
    $idx = $reply.IndexOf("[WRITE_NOTE]")
    $lineEnd = $reply.IndexOf("`n", [Math]::Max(0, $idx))
    if ($lineEnd -lt 0) { $lineEnd = $reply.Length } else { $lineEnd++ }
    $content = $reply.Substring($lineEnd).TrimEnd()
    $replyForHistory = ($reply.Substring(0, $idx).Trim() + "`n[Written to notes/" + $filename + "]").Trim()
    return @{ filename = $filename; content = $content; replyForHistory = $replyForHistory }
}

function Write-NoteFile([string]$filename, [string]$content) {
    . (Join-Path $PSScriptRoot "foxauth.ps1") -ErrorAction SilentlyContinue
    if (-not (Ensure-Login)) {
        Write-Host "Log in first (l <name> <pass>) to write to notes." -ForegroundColor Yellow
        return $false
    }
    $user = $env:FOXTERM_USER
    if ([string]::IsNullOrWhiteSpace($user)) {
        Write-Host "FOXTERM_USER not set. Log in first." -ForegroundColor Yellow
        return $false
    }
    $notesRoot = Join-Path $PSScriptRoot ("notes\" + $user)
    $parent = Split-Path -Parent $filename
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        $dirPath = Join-Path $notesRoot $parent
        if (-not (Test-Path $dirPath)) { New-Item -ItemType Directory -Path $dirPath -Force | Out-Null }
    }
    $filePath = Join-Path $notesRoot $filename
    try {
        $content | Set-Content -LiteralPath $filePath -Encoding UTF8
        Write-Host "Written to notes: $filename" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "Failed to write: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-WriteNoteIntent([string]$userText) {
    if ([string]::IsNullOrWhiteSpace($userText)) { return $false }
    $t = $userText.ToLowerInvariant()
    if ($t -match '\[write_note\]') { return $true }
    # Require an explicit "write/save/create" intent (avoid accidental writes when user mentions a .txt).
    if ($t -match '\b(write|save)\b.*\b(notes?|file|txt)\b') { return $true }
    if ($t -match '\b(make|create)\b.*\b(file|txt|note)\b') { return $true }
    if ($t -match '\b(save|write)\b.*\bto\b.*\bnotes?\b') { return $true }
    return $false
}

function Get-NotesRootForCurrentUser {
    . (Join-Path $PSScriptRoot "foxauth.ps1") -ErrorAction SilentlyContinue
    if (-not (Ensure-Login)) { return $null }
    $user = $env:FOXTERM_USER
    if ([string]::IsNullOrWhiteSpace($user)) { return $null }
    $notesRoot = Join-Path $PSScriptRoot ("notes\" + $user)
    if (-not (Test-Path $notesRoot)) { New-Item -ItemType Directory -Path $notesRoot -Force | Out-Null }
    return $notesRoot
}

function Resolve-NoteFilePath([string]$name) {
    $notesRoot = Get-NotesRootForCurrentUser
    if ($null -eq $notesRoot) { return $null }
    $n = if ($null -eq $name) { "" } else { $name.Trim() }
    if ([string]::IsNullOrWhiteSpace($n)) { return $null }
    $n = $n.Trim('"').Trim("'")
    if ($n -notmatch '(?i)\.txt$') { $n += ".txt" }
    # Block path traversal
    $n = $n -replace '^[/\\]+', '' -replace '\.\.', ''
    $n = $n -replace '[<>:"|?*]', '_'  # invalid on Windows
    $n = $n -replace '[\[\]]', '_'     # keep it simple
    return (Join-Path $notesRoot $n)
}

function Try-HandleNotesSummarize([string]$inputTrim) {
    if ([string]::IsNullOrWhiteSpace($inputTrim)) { return $false }
    $t = $inputTrim.ToLowerInvariant()
    if ($t -notmatch '\b(sum|summarize|summary)\b') { return $false }
    if ($t -notmatch '\b(notes?|folder)\b') { return $false }

    $file = $null
    if ($inputTrim -match '(?i)([a-z0-9._-]+\.txt)') { $file = $matches[1] }
    if ([string]::IsNullOrWhiteSpace($file)) {
        Write-Host "Which note filename? (example: AIfile.txt)" -ForegroundColor DarkYellow
        return $true
    }

    $path = Resolve-NoteFilePath $file
    if ($null -eq $path -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Write-Host "Note not found: $file" -ForegroundColor DarkYellow
        return $true
    }

    $content = ""
    try { $content = Get-Content -LiteralPath $path -Raw -ErrorAction Stop } catch { $content = "" }
    if ([string]::IsNullOrWhiteSpace($content)) {
        Write-Host "Note is empty: $file" -ForegroundColor DarkYellow
        return $true
    }

    # One-shot summarize without writing files.
    $global:FOXTERM_SUPPRESS_WRITE_NOTE = $true
    $prompt = "Summarize the following notes file. Output only the summary as bullet points. Do NOT use [WRITE_NOTE].`nFile: $file`n---`n$content`n---"
    $body = @{
        model = $model
        stream = $stream
        keep_alive = $keepAlive
        messages = @(
            @{ role = "system"; content = $system },
            @{ role = "user"; content = $prompt }
        )
    }
    $payload = $body | ConvertTo-Json -Depth 6

    Write-Host ""
    Write-Host "FRIEND:" -ForegroundColor Cyan -NoNewline
    Write-Host " " -NoNewline
    try {
        $null = Invoke-FriendChat $payload
        Write-Host ""
    } catch {
        Write-Host ""
        Write-Host "Failed to summarize note." -ForegroundColor DarkYellow
    } finally {
        try { Remove-Variable -Name FOXTERM_SUPPRESS_WRITE_NOTE -Scope Global -ErrorAction SilentlyContinue } catch { }
    }

    Write-Host "If you want, say: 'save that summary to <name>.txt'." -ForegroundColor DarkGray
    return $true
}

function Invoke-FriendChat([string]$payloadJson) {
    if ($stream) {
        $lastError = $null
        foreach ($attempt in 1..($maxRetries + 1)) {
            try {
                $req = [System.Net.HttpWebRequest]::Create($url)
                $req.Method = "POST"
                $req.ContentType = "application/json"
                $req.Accept = "application/json"
                $req.Headers["Accept-Charset"] = "utf-8"
                $req.Timeout = $requestTimeoutMs
                $req.ReadWriteTimeout = $requestTimeoutMs
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
                $req.ContentLength = $bytes.Length
                $reqStream = $req.GetRequestStream()
                $reqStream.Write($bytes, 0, $bytes.Length)
                $reqStream.Close()

                $resp = $req.GetResponse()
                $respStream = $resp.GetResponseStream()
                $streamReader = New-Object System.IO.StreamReader($respStream, [System.Text.Encoding]::UTF8, $true)
                $buffer = ""
                $assistantText = New-Object System.Text.StringBuilder
                $suppressWriteNote = $global:FOXTERM_SUPPRESS_WRITE_NOTE
                $seenWriteNote = $false
                while (-not $streamReader.EndOfStream) {
                    $line = $streamReader.ReadLine()
                    if ($null -eq $line) { continue }
                    $line = $line.Trim()
                    if ([string]::IsNullOrWhiteSpace($line)) { continue }
                    if ($line.StartsWith("data:")) { $line = $line.Substring(5).Trim() }
                    if ($line -eq "[DONE]" -or $line -eq "{}") { continue }
                    $buffer += $line
                    try {
                        $obj = $buffer | ConvertFrom-Json
                        $buffer = ""
                        if ($obj.message -and $obj.message.content) {
                            $chunk = $obj.message.content
                            [void]$assistantText.Append($chunk)
                            if ($suppressWriteNote) {
                                if ($chunk -like "*[WRITE_NOTE]*") { $seenWriteNote = $true }
                                if ($seenWriteNote) {
                                    $chunk = $chunk -replace '\[WRITE_NOTE\]', ''
                                    $chunk = $chunk -replace '```', ''
                                }
                            }
                            Write-Host -NoNewline $chunk
                        }
                        if ($obj.done -eq $true) { break }
                    } catch {
                        if ($buffer.Length -gt 500000) { $buffer = "" }
                    }
                }
                $streamReader.Close()
                $resp.Close()
                Write-Host ""
                return $assistantText.ToString()
            } catch {
                $lastError = $_
                if ($attempt -le $maxRetries) {
                    Write-Host "(retry $attempt/$maxRetries...)" -ForegroundColor DarkYellow
                } else {
                    throw $lastError
                }
            }
        }
        throw $lastError
    } else {
        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
        $respParams = @{
            Method = 'Post'
            Uri = $url
            ContentType = 'application/json; charset=utf-8'
            Body = $bodyBytes
            TimeoutSec = [Math]::Max(60, $requestTimeoutMs / 1000)
        }
        if ($PSVersionTable.PSVersion.Major -ge 6) {
            $respParams['ResponseEncoding'] = [System.Text.Encoding]::UTF8
        }
        $resp = Invoke-RestMethod @respParams
        if ($resp.message -and $resp.message.content) {
            $text = $resp.message.content.Trim()
            Write-Host $text
            return $text
        }
        Write-Host "No response from model."
        return ""
    }
}

$messages = New-Object System.Collections.Generic.List[hashtable]
$messages.Add(@{ role = "system"; content = $system }) | Out-Null

function Get-RepoRoot {
    try { return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path } catch { return (Join-Path $PSScriptRoot "..") }
}

function Resolve-RepoFile([string]$pathText) {
    $root = Get-RepoRoot
    if ([string]::IsNullOrWhiteSpace($pathText)) { return $null }
    $p = $pathText.Trim().Trim('"').Trim("'")
    if ([string]::IsNullOrWhiteSpace($p)) { return $null }

    # Support relative paths (from repo root) and absolute paths (must be inside repo).
    $candidate = $p
    if (-not ([System.IO.Path]::IsPathRooted($candidate))) {
        $candidate = Join-Path $root $candidate
    }
    try {
        $resolved = Resolve-Path -LiteralPath $candidate -ErrorAction Stop
        $full = $resolved.Path
        $rootFull = (Resolve-Path -LiteralPath $root).Path
        if ($full.Length -lt $rootFull.Length) { return $null }
        if ($full.Substring(0, $rootFull.Length).ToLowerInvariant() -ne $rootFull.ToLowerInvariant()) {
            return $null
        }
        return $full
    } catch {
        return $null
    }
}

function Read-TextFileLimited([string]$fullPath, [int]$maxChars = 24000) {
    if ([string]::IsNullOrWhiteSpace($fullPath) -or -not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { return $null }

    $ext = ([System.IO.Path]::GetExtension($fullPath)).ToLowerInvariant()
    $allowed = @(".ps1",".bat",".cmd",".cs",".csproj",".sln",".json",".md",".txt",".axaml",".yml",".yaml",".xml")
    if (-not ($allowed -contains $ext)) {
        return "[blocked: unsupported file type $ext]"
    }
    try {
        $text = Get-Content -LiteralPath $fullPath -Raw -ErrorAction Stop
        if ($null -eq $text) { $text = "" }
        if ($text.Length -gt $maxChars) {
            $text = $text.Substring(0, $maxChars) + "`n`n...[TRUNCATED]..."
        }
        return $text
    } catch {
        return "[failed to read file: $($_.Exception.Message)]"
    }
}

function Show-RepoSummary {
    $root = Get-RepoRoot
    Write-Host "Repo: $root" -ForegroundColor DarkGray
    Write-Host "Key folders:" -ForegroundColor DarkGray
    Write-Host "  cmd\           -> FoxTerminal commands (.ps1/.bat), incl. foxhelp, friend, ff, ytm/sp tools" -ForegroundColor DarkGray
    Write-Host "  FoxTerminal\    -> portable Ghostty config + install scripts" -ForegroundColor DarkGray
    Write-Host "  FoxTerminalApp\ -> Avalonia UI terminal app (C#/.NET)" -ForegroundColor DarkGray
    Write-Host "  FireFoxBot\     -> .NET Firefox watcher (opened via ffbot)" -ForegroundColor DarkGray
    Write-Host "" -ForegroundColor DarkGray
    Write-Host "Tip: use /explain <path> to make me read and explain a file." -ForegroundColor DarkGray
}

function Show-ChatCommands {
    Write-Host "Chat commands:" -ForegroundColor DarkGray
    Write-Host "  exitt                 exit chat" -ForegroundColor DarkGray
    Write-Host "  /clear                clear context (keep system prompt)" -ForegroundColor DarkGray
    Write-Host "  /help                 show this help" -ForegroundColor DarkGray
    Write-Host "  /model                show current model" -ForegroundColor DarkGray
    Write-Host "  /cmds                 show FoxTerminal commands overview" -ForegroundColor DarkGray
    Write-Host "  /repo                 show repo structure overview" -ForegroundColor DarkGray
    Write-Host "  /read <path>          print a file (truncated)" -ForegroundColor DarkGray
    Write-Host "  /explain <path>       ask FRIEND to explain a file (truncated)" -ForegroundColor DarkGray
}

function Show-CommandsOverview {
    Write-Host "FoxTerminal commands (overview):" -ForegroundColor DarkGray
    Write-Host "  foxhelp               full interactive help menu" -ForegroundColor DarkGray
    Write-Host "  friend                chat assistant (this)" -ForegroundColor DarkGray
    Write-Host "  ask ""...""             one-shot AI via Ollama" -ForegroundColor DarkGray
    Write-Host "  ff open <alias|url>   open in Firefox (aliases via bbind/blist/bdel)" -ForegroundColor DarkGray
    Write-Host "  youtube | yt <q>      open YouTube / search" -ForegroundColor DarkGray
    Write-Host "  sp | sp-ui            Spotify open / DJ controls UI" -ForegroundColor DarkGray
    Write-Host "  ytm | ytm-ui          YouTube Music open / DJ controls UI" -ForegroundColor DarkGray
    Write-Host "  tg | tgub | tglist    Telegram open + bindings" -ForegroundColor DarkGray
    Write-Host "  wai | go | nfile      notes files (see foxhelp)" -ForegroundColor DarkGray
    Write-Host "  weather | ip | wifi   quick status" -ForegroundColor DarkGray
    Write-Host "  fday                  time + weather + wifi + ip" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Tip: run `foxhelp` for the full list (auto-detected from cmd\)." -ForegroundColor DarkGray
}

function Handle-SlashCommand([string]$inputTrim) {
    # Returns: @{ handled = $true } OR @{ handled=$true; forwardToModel=$true; content="..." }
    if ([string]::IsNullOrWhiteSpace($inputTrim) -or -not $inputTrim.StartsWith("/")) { return $null }

    if ($inputTrim -ceq "/help") {
        Show-ChatCommands
        Write-Host ""
        Write-Host "Open shortcuts: type exactly 'open youtube', 'open spotify', 'open ytm', 'open telegram', 'open notes', etc." -ForegroundColor DarkGray
        return @{ handled = $true }
    }
    if ($inputTrim -ceq "/cmds") {
        Show-CommandsOverview
        return @{ handled = $true }
    }
    if ($inputTrim -ceq "/repo") {
        Show-RepoSummary
        return @{ handled = $true }
    }
    if ($inputTrim -ceq "/model") {
        Write-Host "Model: $model" -ForegroundColor DarkGray
        return @{ handled = $true }
    }
    if ($inputTrim -ceq "/clear") {
        while ($messages.Count -gt 1) { $messages.RemoveAt(1) }
        Write-Host "Context cleared. Only system prompt kept." -ForegroundColor DarkGray
        return @{ handled = $true }
    }
    if ($inputTrim -like "/read *") {
        $arg = $inputTrim.Substring(6).Trim()
        $full = Resolve-RepoFile $arg
        if ($null -eq $full) {
            Write-Host "File not found (or outside repo)." -ForegroundColor DarkYellow
            return @{ handled = $true }
        }
        $text = Read-TextFileLimited $full 24000
        Write-Host ""
        Write-Host ("--- " + $full + " ---") -ForegroundColor DarkGray
        Write-Host $text
        Write-Host ("--- end ---") -ForegroundColor DarkGray
        return @{ handled = $true }
    }
    if ($inputTrim -like "/explain *") {
        $arg = $inputTrim.Substring(9).Trim()
        $full = Resolve-RepoFile $arg
        if ($null -eq $full) {
            Write-Host "File not found (or outside repo)." -ForegroundColor DarkYellow
            return @{ handled = $true }
        }
        $root = Get-RepoRoot
        $rel = $full
        try { $rel = $full.Substring($root.Length).TrimStart('\','/') } catch { }
        $text = Read-TextFileLimited $full 24000
        $prompt = "Explain this file from my FoxTerminal repo: $rel`n`n---`n" + $text + "`n---"
        return @{ handled = $true; forwardToModel = $true; content = $prompt }
    }

    Write-Host "Unknown chat command. Try /help" -ForegroundColor DarkYellow
    return @{ handled = $true }
}

Write-Host ""
Write-Host "FRIEND (Frederik Endiscot) - FoxTerminal assistant" -ForegroundColor Cyan
Write-Host "Chat: exitt = exit. /help for commands. Say 'open youtube/spotify/ytm/telegram/notes' to run and exit. Ask to create/write a file in notes (e.g. 'make AIfile.txt') and say if your words or exact." -ForegroundColor DarkGray
Write-Host "------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

$commandToRunAfterExit = $null
while ($true) {
    $inputText = Read-Host "YOU"
    # Read-Host returns $null once stdin reaches EOF (piped or closed input). Without
    # this guard the loop would spin forever throwing on .Trim().
    if ($null -eq $inputText) {
        Write-Host "Session ended."
        break
    }
    $inputTrim = $inputText.Trim()
    if ($inputTrim -ceq "exitt") {
        Write-Host "Session ended."
        break
    }
    if ([string]::IsNullOrWhiteSpace($inputTrim)) { continue }

    $slash = Handle-SlashCommand $inputTrim
    if ($null -ne $slash -and $slash.handled -eq $true) {
        if ($slash.forwardToModel -eq $true -and $slash.content) {
            # Continue below: treat as a normal user message, but with injected content.
            $inputTrim = [string]$slash.content
        } else {
            continue
        }
    }

    if (Try-HandleNotesSummarize $inputTrim) { continue }

    $kwCmd = Try-RouteCommandByKeywords $inputTrim
    if ($null -ne $kwCmd) {
        Write-Host "Closing chat and opening $($kwCmd.script)..." -ForegroundColor DarkGray
        $commandToRunAfterExit = $kwCmd
        break
    }

    $openCmd = Resolve-OpenCommand -userInput $inputTrim
    if ($null -ne $openCmd) {
        Write-Host "Closing chat and opening $($openCmd.script)..." -ForegroundColor DarkGray
        $commandToRunAfterExit = $openCmd
        break
    }

    $allowWriteNote = Test-WriteNoteIntent $inputTrim
    $global:FOXTERM_SUPPRESS_WRITE_NOTE = (-not $allowWriteNote)
    $messages.Add(@{ role = "user"; content = $inputTrim }) | Out-Null

    $body = @{
        model = $model
        stream = $stream
        keep_alive = $keepAlive
        messages = @($messages)
    }
    if ($numPredict -ne $null -or $numCtx -ne $null) {
        $opts = @{}
        if ($numPredict -ne $null) { $opts.num_predict = $numPredict }
        if ($numCtx -ne $null) { $opts.num_ctx = $numCtx }
        $body.options = $opts
    }
    $payload = $body | ConvertTo-Json -Depth 6

    try {
        Write-Host ""
        Write-Host "FRIEND:" -ForegroundColor Cyan -NoNewline
        Write-Host " " -NoNewline
        $assistantReply = Invoke-FriendChat $payload
        if (-not [string]::IsNullOrWhiteSpace($assistantReply)) {
            $writeNote = Parse-WriteNote $assistantReply
            if ($null -ne $writeNote) {
                if (-not $allowWriteNote) {
                    Write-Host "Blocked [WRITE_NOTE] because you did not ask to write a file." -ForegroundColor DarkYellow
                    $contentToStore = $assistantReply
                } else {
                    $written = Write-NoteFile -filename $writeNote.filename -content $writeNote.content
                    $contentToStore = if ($written) { $writeNote.replyForHistory } else { $assistantReply }
                }
            } else {
                $contentToStore = $assistantReply
            }
            $messages.Add(@{ role = "assistant"; content = $contentToStore }) | Out-Null
            Trim-MessageHistory -msgList $messages -maxPairs $maxTurns
        }
        Write-Host ""
    } catch {
        Write-Host "Ollama request failed."
        Write-Host "Check that Ollama is running."
        Write-Host "Example:"
        Write-Host "  & `"C:\Program Files\Ollama\ollama.exe`" serve"
        Write-Host "Model: $model"
        Write-Host $_.Exception.Message
        break
    }
}

try { Remove-Variable -Name FOXTERM_SUPPRESS_WRITE_NOTE -Scope Global -ErrorAction SilentlyContinue } catch { }

if ($null -ne $commandToRunAfterExit) {
    $base = $commandToRunAfterExit.script
    $ps1 = Join-Path $PSScriptRoot ($base + ".ps1")
    $bat = Join-Path $PSScriptRoot ($base + ".bat")
    $cmd = Join-Path $PSScriptRoot ($base + ".cmd")
    if (Test-Path -LiteralPath $ps1) {
        & $ps1 @($commandToRunAfterExit.args)
    } elseif (Test-Path -LiteralPath $bat) {
        & $bat @($commandToRunAfterExit.args)
    } elseif (Test-Path -LiteralPath $cmd) {
        & $cmd @($commandToRunAfterExit.args)
    } else {
        Write-Host "Command not found: $base (.ps1/.bat/.cmd)" -ForegroundColor Red
    }
}
