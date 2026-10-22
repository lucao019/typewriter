# Changelog

As mudanças relevantes do projeto são registradas neste arquivo.

## [0.1.0] - 2026-10-22

### Adicionado

- Aplicativo desktop com Electron, React e TypeScript.
- Seleção nativa de arquivos de áudio no Windows.
- Pipeline local de transcrição usando FFmpeg e whisper.cpp.
- Configuração automatizada do ambiente Windows e download validado do modelo Whisper `small`.
- Exibição do resultado e gravação de transcrição em arquivo `.txt`.
- Testes automatizados iniciais e documentação do projeto.

### Corrigido

- Localização do executável whisper.cpp instalado dentro do projeto, sem depender exclusivamente do PATH.
- Seleção de áudio via diálogo nativo do Electron para obter o caminho real do arquivo.
