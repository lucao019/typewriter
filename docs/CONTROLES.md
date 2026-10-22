# Controles da interface

Referência do controle visível até a operação executada e o resultado apresentado. O processo principal do Electron valida caminhos, executa tarefas e grava o estado local; a interface não acessa o sistema de arquivos diretamente.

## Navegação e início

| Controle | Ação/backend | Resultado e falhas |
| --- | --- | --- |
| Navegação lateral | Altera a página exibida no React. | A página ativa é realçada; não inicia operações. |
| Recolher/expandir menu | Salva a preferência no `localStorage` do renderer. | O menu permanece no estado escolhido após reabrir a janela. |
| Nova transcrição | Abre a página de importação. | Exibe seleção e fila. |
| Cards do início | Lê fila, histórico e diagnóstico pelos canais IPC. | Mostra contagens locais e disponibilidade do mecanismo/modelo. |
| Transcrições recentes / Abrir histórico | Abre o histórico persistido. | Permite consultar registros anteriores. |

## Nova transcrição e fila

| Controle | Ação/backend | Resultado e falhas |
| --- | --- | --- |
| Selecionar arquivos | Abre o diálogo do Electron; valida extensão e arquivo, mede duração quando `ffprobe` está disponível e persiste a fila. | Mostra quantidade importada ou erro explícito. |
| Soltar arquivos | Obtém o caminho real pelo `webUtils.getPathForFile` do Electron e usa a mesma validação da seleção. | Arquivos sem caminho ou formato suportado não são transcritos. |
| Selecionar todos / checkbox | Atualiza a seleção local dos itens. | Não inicia processamento. |
| Modelo / idioma | Seleciona uma opção instalada e o idioma da próxima tarefa. | Idioma automático ativa a detecção do Whisper. Modelos ausentes ficam desabilitados. |
| Iniciar selecionados / Iniciar fila | Chama `transcriptions:transcribe`; executa sequencialmente com FFmpeg e whisper.cpp. | Atualiza estado, progresso quando informado pelo Whisper, texto, arquivo TXT e histórico. Erros aparecem na mensagem da tarefa e nos logs. |
| Cancelar | Aborta o subprocesso ativo com `AbortController`. | A tarefa passa para cancelada e a fila pode prosseguir para a próxima. |
| Remover | Retira itens pendentes; registros concluídos ou com erro permanecem no histórico. | A interface atualiza fila e histórico. |
| Limpar pendentes / Limpar concluídas | Solicita confirmação e remove apenas os itens elegíveis da fila. | O histórico não é apagado. |

## Histórico

| Controle | Ação/backend | Resultado e falhas |
| --- | --- | --- |
| Busca, estado e período | Filtra os registros carregados localmente. | Atualiza a lista sem alterar dados. |
| Abrir / Copiar | Exibe o texto ou usa a área de transferência do sistema. | Falhas de clipboard são informadas. |
| Exportar TXT | Abre o diálogo nativo de gravação. | Pode abrir o arquivo salvo conforme a preferência; falhas são exibidas. |
| Abrir TXT | Abre o arquivo de resultado persistido. | Se o arquivo tiver sido movido ou apagado, informa que não está disponível. |
| Reprocessar / Tentar novamente | Valida novamente o original, re-adiciona à fila e executa a transcrição. | Atualiza o resultado e o histórico; erros são exibidos. |
| Excluir | Solicita confirmação e remove o registro local do histórico. | Não apaga o áudio original nem o TXT já exportado. |

## Modelos

| Controle | Ação/backend | Resultado e falhas |
| --- | --- | --- |
| Verificar novamente | Consulta executáveis e arquivos de modelo encontrados no computador. | Atualiza o estado disponível/ausente e o caminho detectado. |
| Selecionar modelo | Valida e salva o modelo instalado como padrão. | Modelos não encontrados não podem ser selecionados. Não há download pela interface. |

## Configurações

| Controle | Ação/backend | Resultado e falhas |
| --- | --- | --- |
| Modelo e idioma padrão | Salva preferências para as próximas tarefas. | Modelo precisa estar instalado; idioma aceita português, inglês ou detecção automática. |
| Manter WAV temporário | Configura a limpeza do WAV de trabalho em `%TEMP%`. | Desativado por padrão; quando ativado, os WAVs permanecem no diretório temporário do sistema. |
| Abrir TXT após exportar | Abre o resultado depois de uma exportação concluída. | Erros ao abrir o arquivo são informados. |
| Iniciar com Windows | Ajusta a configuração de início de sessão do Electron no Windows. | O suporte é específico ao Windows. |
| Nível mínimo de log | Filtra novas entradas persistidas abaixo do nível selecionado. | Logs já gravados não são apagados. |
| Pastas de entrada, saída e modelos | Abre o seletor nativo, valida diretórios e persiste a preferência. | A pasta de saída altera a localização padrão do TXT; a pasta de modelos participa da busca. |
| Restaurar padrões / Salvar configurações | Restaura valores padrão ou persiste a edição atual. | Mensagem de confirmação ou erro visível. |

## Logs e diagnóstico

| Controle | Ação/backend | Resultado e falhas |
| --- | --- | --- |
| Executar diagnóstico | Verifica FFmpeg, Whisper, modelo selecionado e diretório de dados. | Apresenta disponibilidade e caminhos detectados. |
| Busca e nível | Filtra mensagens locais por texto e severidade. | A lista é atualizada automaticamente a cada cinco segundos nesta página. |
| Copiar | Copia mensagem e detalhes do log. | Confirma sucesso ou informa erro de clipboard. |
| Exportar | Abre o diálogo nativo para JSON ou texto. | O conteúdo corresponde à extensão escolhida. |
| Limpar logs | Solicita confirmação e remove as entradas persistidas. | Não altera fila nem histórico de transcrição. |

## Limitações explícitas

- Execução sequencial (uma tarefa por vez); não há pausa nem concorrência paralela.
- A porcentagem depende da saída do whisper.cpp e pode não estar disponível em toda compilação.
- Não há download de modelos pela interface, aceleração GPU ou telemetria de recursos.
- O resultado não inclui timestamps segmentados; exportação SRT/VTT não é oferecida.
- O histórico e as configurações são arquivos JSON locais e não são criptografados.
