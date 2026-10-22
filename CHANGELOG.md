# Changelog

As mudanças relevantes do projeto são registradas neste arquivo.

## [0.1.0] - 2026-10-22

### Adicionado

- Aplicativo desktop com Electron, React e TypeScript.
- Seleção nativa de arquivos de áudio no Windows.
- API IPC para adicionar, listar, remover e atualizar arquivos e estados de transcrição.
- Persistência local da fila, histórico, configurações e logs em JSON.
- Interface funcional para início, nova transcrição, fila, histórico, modelos, configurações e diagnóstico.
- Pipeline local de transcrição usando FFmpeg e whisper.cpp.
- Configuração automatizada do ambiente Windows e download validado do modelo Whisper `small`.
- Progresso e cancelamento de tarefas usando subprocessos assíncronos.
- Exibição, reprocessamento e exportação de transcrições em arquivo `.txt`.
- Diagnóstico local, logs filtráveis/exportáveis, seleção de diretórios e preferências persistentes.
- Testes automatizados iniciais e documentação do projeto.

### Corrigido

- Localização do executável whisper.cpp instalado dentro do projeto, sem depender exclusivamente do PATH.
- Seleção de áudio via diálogo nativo do Electron para obter o caminho real do arquivo.
- Extensão do arquivo de dados corrigida para `.json`, correspondente ao formato realmente usado.
- Opções de idioma, retenção de temporários e exportação de logs alinhadas ao comportamento configurado.

### Limitações

- A fila é sequencial; pausa, paralelismo e GPU não estão disponíveis.
- A interface não baixa modelos e não gera SRT/VTT sem timestamps segmentados.
