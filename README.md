# LUCAO Audio Transcriber

Aplicativo desktop para transcrever arquivos de áudio localmente, com foco em português brasileiro. O processamento é feito no próprio computador com FFmpeg e whisper.cpp; os arquivos de áudio não precisam ser enviados a um serviço de transcrição na nuvem.

## O que já funciona

- Seleção de um ou mais arquivos de áudio pelo seletor nativo do Windows.
- Conversão do áudio para WAV mono a 16 kHz com FFmpeg.
- Transcrição local com whisper.cpp e o modelo `small`.
- Exibição do texto transcrito, reprocessamento do histórico e exportação do resultado como `.txt`.
- Mensagens de erro quando faltam ferramentas, modelos ou arquivos válidos.
- Fila sequencial com progresso reportado pelo Whisper.cpp e cancelamento da tarefa ativa.
- Histórico persistente de transcrições, configurações e logs no computador.
- Diagnóstico local de FFmpeg, Whisper, modelo selecionado e diretório de dados.

Formatos aceitos: WAV, MP3, M4A, AAC, FLAC, OGG, OPUS e WEBM.

> O histórico e as configurações são armazenados como JSON no diretório de dados do Electron. Transcrições temporárias WAV são removidas por padrão. O processamento permanece local.

## Tecnologias

- Electron, React e TypeScript para o aplicativo desktop.
- Vite para desenvolvimento e build da interface.
- FFmpeg para preparar o áudio.
- whisper.cpp para inferência local.
- Vitest para testes.
- Arquivo JSON local com substituição atômica para persistir fila, histórico, configurações e logs.

Consulte [FERRAMENTAS.md](./FERRAMENTAS.md) para detalhes de desenvolvimento, dependências e mecanismo de transcrição.

## Requisitos

- Windows 10/11 x64.
- Node.js 20+ e npm.
- FFmpeg.
- Git, CMake e Visual Studio Build Tools com ferramentas C++ para compilar whisper.cpp.
- Aproximadamente 500 MB livres para o modelo `small`, além do espaço de build.

## Começar

Instale as dependências JavaScript:

```powershell
npm install
```

Configure o mecanismo local no PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-transcription-env.ps1
```

O script verifica/instala ferramentas pelo `winget`, compila whisper.cpp em `tools\whisper.cpp` e baixa e valida o modelo `small`. A pasta `tools` é local e não faz parte do repositório. Depois da configuração, feche e reabra o terminal e o app para atualizar o `PATH`.

Confira as ferramentas:

```powershell
.\scripts\verify-transcription-env.ps1
```

Inicie o aplicativo:

```powershell
npm run dev
```

Para abrir o app compilado:

```powershell
npm run build
npm run start
```

Selecione os arquivos usando **Selecionar arquivos** e pressione **Iniciar selecionados**. Por padrão, o texto é salvo como `<nome-do-audio>-transcricao.txt` junto ao áudio; uma pasta de saída pode ser configurada. A interface permite abrir, copiar, exportar novamente e reprocessar registros do histórico.

## Limitações conhecidas

- Modelos não são baixados pela interface; use o script de setup local.
- A fila executa uma transcrição por vez. Pausa e concorrência paralela não são suportadas.
- A saída atual contém texto, sem timestamps segmentados; por isso, SRT e VTT não são oferecidos.
- A aceleração por GPU e a telemetria de recursos não estão implementadas.
- A preferência de inicialização automática é aplicada no Windows.
- O armazenamento local não é criptografado. Os dados permanecem no perfil local do usuário.

## Desenvolvimento e validação

```powershell
npm test
npm run build
```

Para gerar o pacote Windows:

```powershell
npm run package
```

## Estrutura

```text
src/main/          Processo principal do Electron e acesso a arquivos
src/preload/       API IPC segura exposta à interface
src/renderer/      Interface React
src/modules/       Transcrição, áudio, configurações e demais módulos
src/__tests__/     Testes automatizados
scripts/           Configuração e verificação das ferramentas locais
tools/             Whisper.cpp e modelos locais (não versionados)
```

O arquivo de dados do aplicativo é `lucao-data.json` no diretório `userData` do Electron.

## Princípios do projeto

Este projeto prioriza processamento local, transparência sobre o estado real das funcionalidades, privacidade dos arquivos de áudio e mudanças pequenas que possam ser testadas. Veja [MENTALIDADE.md](./MENTALIDADE.md).

## Documentação

- [FERRAMENTAS.md](./FERRAMENTAS.md) — stack, dependências e setup local.
- [CHANGELOG.md](./CHANGELOG.md) — mudanças por versão.
- [MENTALIDADE.md](./MENTALIDADE.md) — princípios e critérios de decisão.
- [docs/CONTROLES.md](./docs/CONTROLES.md) — controles da interface, operações reais e limitações.
