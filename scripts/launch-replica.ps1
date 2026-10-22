$ErrorActionPreference = 'Stop'
$replicaRoot = Split-Path -Parent $PSScriptRoot
$replicaUrl = 'http://127.0.0.1:5174/?view=replica'

# TMP/TEMP 若被配置为未展开的 %USERPROFILE% 字面量，Node 的 os.tmpdir() 会返回
# 无效路径，导致 Hypit 的 Chrome（puppeteer）无法启动（Code 21）而渲染失败。
# 这里仅对本站服务进程树修正，不修改系统环境变量。
$realTemp = Join-Path $env:USERPROFILE 'AppData\Local\Temp'
if ($env:TMP -match '%USERPROFILE%') { $env:TMP = $realTemp }
if ($env:TEMP -match '%USERPROFILE%') { $env:TEMP = $realTemp }
if (-not (Test-Path -LiteralPath $env:TMP)) { New-Item -ItemType Directory -Path $env:TMP -Force | Out-Null }

function Test-ReplicaPort {
    $client = $null
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $task = $client.ConnectAsync('127.0.0.1', 5174)
        if (-not $task.Wait(700)) { return $false }
        return $client.Connected
    } catch { return $false }
    finally { if ($client) { $client.Dispose() } }
}

function Test-ReplicaService {
    # 只要服务能返回 health（含渲染器 warming / ready=false）即视为已启动；冷启动探测放宽到 10 秒。
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:5174/api/replica/health' -TimeoutSec 10
        return ($health.PSObject.Properties.Name -contains 'ready')
    } catch { return $false }
}

function Test-RagPort {
    $client = $null
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $task = $client.ConnectAsync('127.0.0.1', 8765)
        if (-not $task.Wait(700)) { return $false }
        return $client.Connected
    } catch { return $false }
    finally { if ($client) { $client.Dispose() } }
}

function Test-RagService {
    # RAG 就绪需要真实模型 ready=true；未就绪时主工作台会降级，不阻断启动。
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:8765/health' -TimeoutSec 5
        return [bool]$health.ready
    } catch { return $false }
}

try {
    $browser = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $browser) { throw 'Chrome or Edge is required.' }

    $logs = Join-Path $replicaRoot '.codex-run\replica-app'

    # 先启动 RAG 微服务（若已安装且端口未监听）。它启动失败不阻断主工作台，后续会降级。
    $ragRoot = Join-Path $replicaRoot 'rag-service'
    $ragPython = Join-Path $ragRoot '.venv\Scripts\python.exe'
    if (Test-Path -LiteralPath $ragPython) {
        if (-not (Test-RagPort)) {
            $ragLogs = Join-Path $replicaRoot '.codex-run\rag-service'
            New-Item -ItemType Directory -Path $ragLogs -Force | Out-Null
            $ragStamp = [Guid]::NewGuid().ToString('N')
            $env:TRANSFORMERS_OFFLINE = '1'
            Start-Process -FilePath $ragPython -ArgumentList @('-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8765') -WorkingDirectory $ragRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $ragLogs "$ragStamp.out.log") -RedirectStandardError (Join-Path $ragLogs "$ragStamp.err.log") | Out-Null
        }
        for ($ragAttempt = 0; $ragAttempt -lt 90; $ragAttempt++) {
            if (Test-RagService) { break }
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not (Test-ReplicaPort)) {
        $node = (Get-Command node -ErrorAction Stop).Source
        $vite = Join-Path $replicaRoot 'node_modules\vite\bin\vite.js'
        if (-not (Test-Path -LiteralPath $vite)) { throw 'Project dependencies are missing. Run npm install in the project folder.' }
        New-Item -ItemType Directory -Path $logs -Force | Out-Null
        $stamp = [Guid]::NewGuid().ToString('N')
        Start-Process -FilePath $node -ArgumentList @("`"$vite`"", '--host', '127.0.0.1', '--port', '5174', '--strictPort') -WorkingDirectory $replicaRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "$stamp.out.log") -RedirectStandardError (Join-Path $logs "$stamp.err.log") | Out-Null
    }

    # 端口已监听（本次启动或已有进程）时只等待 health，不重复启动 Vite。
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (Test-ReplicaService) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw "The local workbench did not answer health checks within 20 seconds. If port 5174 is already in use, inspect that process. Logs: $logs" }

    $profile = Join-Path $env:LOCALAPPDATA 'ReplicaWorkbench\BrowserProfile'
    Start-Process -FilePath $browser -ArgumentList @("--user-data-dir=`"$profile`"", "--app=$replicaUrl", '--start-maximized', '--no-first-run', '--no-default-browser-check') -WindowStyle Normal | Out-Null
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Video Replica Workbench') | Out-Null
    exit 1
}
