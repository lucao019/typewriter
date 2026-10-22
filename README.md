# LUCAO Audio Transcriber

Aplicativo desktop para transcrever arquivos de áudio localmente, com foco em português brasileiro. O processamento é feito no próprio computador com FFmpeg e whisper.cpp; os arquivos de áudio não precisam ser enviados a um serviço de transcrição na nuvem.

## O que já funciona

- Seleção de um ou mais arquivos de áudio pelo seletor nativo do Windows.
- Conversão do áudio para WAV mono a 16 kHz com FFmpeg.
- Transcrição local com whisper.cpp e o modelo `small`.
- Exibição do texto transcrito na lista de arquivos e gravação de um arquivo `.txt` junto ao áudio original.
- Mensagens de erro quando faltam ferramentas, modelos ou arquivos válidos.

Formatos aceitos: WAV, MP3, M4A, AAC, FLAC, OGG, OPUS e WEBM.

> O histórico persistente, as configurações completas, a exportação em vários formatos e os demais módulos ainda estão em desenvolvimento.

## Tecnologias

- Electron, React e TypeScript para o aplicativo desktop.
- Vite para desenvolvimento e build da interface.
- FFmpeg para preparar o áudio.
- whisper.cpp para inferência local.
- Vitest para testes.
- SQLite (`better-sqlite3`) como dependência prevista para persistência futura.

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

Selecione os arquivos usando **Selecionar arquivos** e pressione **Transcrever**. O texto é exibido no aplicativo e salvo como `<nome-do-audio>-transcricao.txt` na pasta do áudio.

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

## Princípios do projeto

Este projeto prioriza processamento local, transparência sobre o estado real das funcionalidades, privacidade dos arquivos de áudio e mudanças pequenas que possam ser testadas. Veja [MENTALIDADE.md](./MENTALIDADE.md).

## Documentação

- [FERRAMENTAS.md](./FERRAMENTAS.md) — stack, dependências e setup local.
- [CHANGELOG.md](./CHANGELOG.md) — mudanças por versão.
- [MENTALIDADE.md](./MENTALIDADE.md) — princípios e critérios de decisão.
