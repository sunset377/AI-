$ErrorActionPreference = 'Stop'
$replicaRoot = Split-Path -Parent $PSScriptRoot
$replicaUrl = 'http://127.0.0.1:5174/?view=replica'

function Test-ReplicaService {
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:5174/api/replica/health' -TimeoutSec 2
        return ($health.PSObject.Properties.Name -contains 'ready')
    } catch { return $false }
}

try {
    $browser = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $browser) { throw 'Chrome or Edge is required.' }

    if (-not (Test-ReplicaService)) {
        $node = (Get-Command node -ErrorAction Stop).Source
        $vite = Join-Path $replicaRoot 'node_modules\vite\bin\vite.js'
        if (-not (Test-Path -LiteralPath $vite)) { throw 'Project dependencies are missing. Run npm install in the project folder.' }
        $logs = Join-Path $replicaRoot '.codex-run\replica-app'
        New-Item -ItemType Directory -Path $logs -Force | Out-Null
        $stamp = [Guid]::NewGuid().ToString('N')
        Start-Process -FilePath $node -ArgumentList @("`"$vite`"", '--host', '127.0.0.1', '--port', '5174', '--strictPort') -WorkingDirectory $replicaRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "$stamp.out.log") -RedirectStandardError (Join-Path $logs "$stamp.err.log") | Out-Null
        $ready = $false
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if (Test-ReplicaService) { $ready = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $ready) { throw "The local workbench did not start. Check $logs or port 5174." }
    }

    $profile = Join-Path $env:LOCALAPPDATA 'ReplicaWorkbench\BrowserProfile'
    Start-Process -FilePath $browser -ArgumentList @("--user-data-dir=`"$profile`"", "--app=$replicaUrl", '--start-maximized', '--no-first-run', '--no-default-browser-check') -WindowStyle Normal | Out-Null
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Video Replica Workbench') | Out-Null
    exit 1
}
