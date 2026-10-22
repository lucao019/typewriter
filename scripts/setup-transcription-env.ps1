$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot 'tools'
$whisperDir = Join-Path $toolsDir 'whisper.cpp'
$ffmpegInstallDir = 'C:\ffmpeg'
$whisperBinDir = Join-Path $whisperDir 'build\bin'

function Refresh-Path {
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $env:Path = "$userPath;$machinePath"
}

function Write-Info($Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Test-Command($Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    return $null -ne $command
}

function Add-ToUserPath($FolderPath) {
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not $userPath) {
        $userPath = ''
    }

    $paths = $userPath -split ';'
    if ($paths -notcontains $FolderPath) {
        $newUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $FolderPath } else { "$userPath;$FolderPath" }
        [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
        Write-Info "Adicionado ao PATH do usuário: $FolderPath"
    }

    $env:Path = "$FolderPath;$env:Path"
}

function Install-WingetPackage($Id) {
    if (-not (Test-Command 'winget')) {
        throw 'winget não está disponível. Instale o App Installer / winget e tente novamente.'
    }

    Write-Info "Instalando $Id ..."
    & winget install --id $Id -e --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao instalar $Id"
    }
}

function Ensure-Tool($CommandName, $WingetId, $InstallHint) {
    if (Test-Command $CommandName) {
        Write-Info "$CommandName já está disponível."
        return
    }

    Write-Info "$CommandName não foi encontrado. Tentando instalar ..."
    try {
        Install-WingetPackage $WingetId
    }
    catch {
        Write-Host "[WARN] Não foi possível instalar automaticamente $CommandName. $InstallHint" -ForegroundColor Yellow
    }
}

Set-Location $projectRoot

Write-Info 'Verificando dependências do sistema ...'
Ensure-Tool 'git' 'Git.Git' 'Instale o Git manualmente em https://git-scm.com/download/win.'
Ensure-Tool 'cmake' 'Kitware.CMake' 'Instale o CMake manualmente em https://cmake.org/download/.'
Refresh-Path

if (-not (Test-Command 'git')) {
    throw 'Git não foi encontrado no PATH. Instale-o e execute este script novamente.'
}
if (-not (Test-Command 'cmake')) {
    throw 'CMake não foi encontrado no PATH. Instale-o e execute este script novamente.'
}

if (-not (Test-Command 'ffmpeg')) {
    if (Test-Path $ffmpegInstallDir) {
        Write-Info "FFmpeg encontrado em $ffmpegInstallDir"
        Add-ToUserPath (Join-Path $ffmpegInstallDir 'bin')
    }
    else {
        Write-Info 'FFmpeg não encontrado. Tentando instalar via winget ...'
        try {
            Install-WingetPackage 'Gyan.Dev.FFmpeg'
            $ffmpegBin = Join-Path $env:ProgramFiles 'ffmpeg\bin'
            if (Test-Path $ffmpegBin) {
                Add-ToUserPath $ffmpegBin
            }
        }
        catch {
            Write-Host "[WARN] FFmpeg não pôde ser instalado automaticamente. Instale manualmente em https://www.ffmpeg.org/download.html e adicione a pasta bin ao PATH." -ForegroundColor Yellow
        }
    }
}

if (-not (Test-Command 'ffmpeg')) {
    Write-Host "[WARN] FFmpeg ainda não está no PATH. Reabra o terminal após a instalação e rode novamente este script." -ForegroundColor Yellow
}

if (-not (Test-Path $whisperDir)) {
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
    Write-Info "Clonando whisper.cpp em $whisperDir ..."
    & git clone https://github.com/ggerganov/whisper.cpp.git $whisperDir
    if ($LASTEXITCODE -ne 0) {
        throw 'Falha ao clonar whisper.cpp.'
    }
}
else {
    Write-Info "Diretório do whisper.cpp já existe em $whisperDir"
}

Write-Info 'Configurando e compilando whisper.cpp ...'
Set-Location $whisperDir

if (-not (Test-Path (Join-Path $whisperDir 'build'))) {
    & cmake -S . -B build
    if ($LASTEXITCODE -ne 0) {
        throw 'Falha ao configurar whisper.cpp com CMake.'
    }
}

& cmake --build build --config Release
if ($LASTEXITCODE -ne 0) {
    throw 'Falha ao compilar whisper.cpp.'
}

$whisperExecutable = @(
    (Join-Path $whisperBinDir 'Release\whisper-cli.exe'),
    (Join-Path $whisperBinDir 'whisper-cli.exe'),
    (Join-Path $whisperBinDir 'Release\whisper.exe'),
    (Join-Path $whisperBinDir 'whisper.exe'),
    (Join-Path $whisperBinDir 'Release\main.exe'),
    (Join-Path $whisperBinDir 'main.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $whisperExecutable) {
    throw 'Whisper não foi encontrado após a compilação. Verifique se a build gerou os executáveis corretamente.'
}

Add-ToUserPath (Split-Path -Parent $whisperExecutable)

$modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin'
$modelPath = Join-Path (Join-Path $whisperDir 'models') 'ggml-small.bin'
$modelDownloadPath = "$modelPath.download"
$expectedModelSize = 487601967
$expectedModelHash = '1BE3A9B2063867B937E64E2EC7483364A79917E157FA98C5D94B5C1FFFEA987B'
$modelIsValid = $false

if (Test-Path -LiteralPath $modelPath) {
    $existingModel = Get-Item -LiteralPath $modelPath
    if ($existingModel.Length -eq $expectedModelSize) {
        $existingModelHash = (Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash
        $modelIsValid = $existingModelHash -eq $expectedModelHash
    }
}

if (-not $modelIsValid) {
    New-Item -ItemType Directory -Path (Join-Path $whisperDir 'models') -Force | Out-Null
    Write-Info "Baixando e validando o modelo small em $modelPath ..."

    try {
        Remove-Item -LiteralPath $modelDownloadPath -Force -ErrorAction SilentlyContinue
        Invoke-WebRequest -Uri $modelUrl -OutFile $modelDownloadPath

        $downloadedModel = Get-Item -LiteralPath $modelDownloadPath
        $downloadedModelHash = (Get-FileHash -LiteralPath $modelDownloadPath -Algorithm SHA256).Hash
        if ($downloadedModel.Length -ne $expectedModelSize -or $downloadedModelHash -ne $expectedModelHash) {
            throw 'O modelo small baixado não passou na validação de tamanho e SHA-256.'
        }

        Move-Item -LiteralPath $modelDownloadPath -Destination $modelPath -Force
    }
    catch {
        Remove-Item -LiteralPath $modelDownloadPath -Force -ErrorAction SilentlyContinue
        throw
    }
}
else {
    Write-Info "Modelo small válido já está presente: $modelPath"
}

Write-Host ''
Write-Host '======================================' -ForegroundColor Green
Write-Host 'Ambiente de transcrição configurado.' -ForegroundColor Green
Write-Host '======================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Valide com:' -ForegroundColor Yellow
Write-Host '  ffmpeg -version' -ForegroundColor White
Write-Host '  whisper-cli.exe --help' -ForegroundColor White
Write-Host '  Get-Command whisper-cli.exe' -ForegroundColor White
Write-Host ''
Write-Host 'Se o PATH foi atualizado, feche e reabra o terminal antes de testar.' -ForegroundColor Yellow
