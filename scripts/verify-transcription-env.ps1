$ErrorActionPreference = 'Stop'

$checks = @(
    @{ Name = 'ffmpeg'; Command = 'ffmpeg'; Args = '-version' },
    @{ Name = 'Whisper.cpp'; Command = 'whisper-cli.exe'; Args = '--help' },
    @{ Name = 'git'; Command = 'git'; Args = '--version' }
)

foreach ($check in $checks) {
    $cmd = Get-Command $check.Command -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Host "[FALTA] $($check.Name) não está no PATH." -ForegroundColor Red
        continue
    }

    Write-Host "[OK] $($check.Name) encontrado em $($cmd.Source)" -ForegroundColor Green
}

$whisperPath = Get-Command whisper-cli.exe -ErrorAction SilentlyContinue
if ($whisperPath) {
    & whisper-cli.exe --help | Select-Object -First 10
}

$ffmpegPath = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpegPath) {
    & ffmpeg -version | Select-Object -First 5
}
