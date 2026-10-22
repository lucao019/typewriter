# Ferramentas e tecnologias

## Aplicativo

| Ferramenta | Uso |
| --- | --- |
| Electron 34 | Aplicativo desktop e integração com arquivos e diálogos do Windows |
| React 18 | Interface |
| TypeScript 5 | Tipagem e compilação dos processos principal e renderer |
| Vite 6 | Servidor de desenvolvimento e build da interface |
| Vitest 2 | Testes automatizados |
| better-sqlite3 | Dependência para persistência local planejada |

## Transcrição local

| Ferramenta | Uso |
| --- | --- |
| FFmpeg | Decodifica formatos de entrada e prepara WAV mono a 16 kHz |
| whisper.cpp | Reconhecimento de fala local |
| Modelo Whisper `small` | Modelo padrão em português; download de aproximadamente 488 MB |

O áudio e o modelo são processados localmente. O mecanismo não envia gravações a um serviço remoto.

## Ferramentas de desenvolvimento no Windows

- Node.js 20+ e npm para dependências e scripts.
- Git para obter whisper.cpp e versionar o projeto.
- CMake para configurar a compilação do whisper.cpp.
- Visual Studio Build Tools com o compilador C++ x64 para compilar whisper.cpp.
- winget para instalação automatizada de ferramentas quando disponível.

## Setup do mecanismo

O script [`scripts/setup-transcription-env.ps1`](./scripts/setup-transcription-env.ps1) prepara o ambiente no Windows:

1. Verifica Git, CMake e FFmpeg.
2. Obtém whisper.cpp em `tools\whisper.cpp`.
3. Compila o executável `whisper-cli`.
4. Baixa o modelo `ggml-small.bin` e valida tamanho e SHA-256.
5. Adiciona o diretório do executável ao PATH do usuário.

O script [`scripts/verify-transcription-env.ps1`](./scripts/verify-transcription-env.ps1) verifica as ferramentas instaladas. Os binários compilados e o modelo ficam em `tools`, diretório local ignorado pelo Git.

## Comandos de desenvolvimento

```powershell
npm install
npm run dev
npm test
npm run build
npm run package
```
