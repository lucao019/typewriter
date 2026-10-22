$ErrorActionPreference = 'Stop'
$hasFailure = $false

$checks = @(
    @{ Name = 'ffmpeg'; Command = 'ffmpeg'; Args = '-version' },
    @{ Name = 'git'; Command = 'git'; Args = '--version' }
)

foreach ($check in $checks) {
    $cmd = Get-Command $check.Command -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Host "[FALTA] $($check.Name) não está no PATH." -ForegroundColor Red
        $hasFailure = $true
        continue
    }

    Write-Host "[OK] $($check.Name) encontrado em $($cmd.Source)" -ForegroundColor Green
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$localWhisperPath = Join-Path $projectRoot 'tools\whisper.cpp\build\bin\Release\whisper-cli.exe'
$whisperCommand = Get-Command whisper-cli.exe -ErrorAction SilentlyContinue
$whisperExecutable = if ($whisperCommand) { $whisperCommand.Source } elseif (Test-Path $localWhisperPath) { $localWhisperPath } else { $null }

if ($whisperExecutable) {
    Write-Host "[OK] Whisper.cpp encontrado em $whisperExecutable" -ForegroundColor Green
    $whisperVersion = & $whisperExecutable --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] $whisperVersion" -ForegroundColor Green
    }
    else {
        Write-Host '[FALHA] Whisper.cpp foi encontrado, mas não respondeu ao comando --version.' -ForegroundColor Red
        $hasFailure = $true
    }
}
else {
    Write-Host '[FALTA] whisper-cli.exe não está no PATH nem na instalação local do projeto.' -ForegroundColor Red
}

$smallModelPath = Join-Path $projectRoot 'tools\whisper.cpp\models\ggml-small.bin'
if (Test-Path $smallModelPath) {
    Write-Host "[OK] Modelo small encontrado em $smallModelPath" -ForegroundColor Green
}
else {
    Write-Host "[FALTA] Modelo small não encontrado em $smallModelPath" -ForegroundColor Red
    $hasFailure = $true
}

$ffmpegPath = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpegPath) {
    $ffmpegVersion = & $ffmpegPath.Source -version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] $($ffmpegVersion[0])" -ForegroundColor Green
    }
    else {
        Write-Host '[FALHA] FFmpeg foi encontrado, mas não respondeu ao comando -version.' -ForegroundColor Red
        $hasFailure = $true
    }
}

if ($hasFailure) {
    exit 1
}
