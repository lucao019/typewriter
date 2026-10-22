# Mentalidade do projeto

Este arquivo registra os princípios que orientam decisões de produto e implementação no LUCAO Audio Transcriber.

## Princípios

1. **Privacidade por padrão** — áudio e transcrição devem permanecer no computador, a menos que uma futura integração remota seja explícita e consentida.
2. **Honestidade sobre o que funciona** — a interface e a documentação não devem apresentar recursos planejados ou simulados como concluídos.
3. **Fluxo confiável antes de ampliar o escopo** — importar, processar, salvar e recuperar uma transcrição corretamente vem antes de adicionar opções avançadas.
4. **Erros compreensíveis** — dependências ausentes, formatos inválidos e falhas de processamento precisam gerar mensagens úteis, sem aparentar sucesso.
5. **Simplicidade e manutenção** — preferir mudanças pequenas, tipos explícitos e padrões já usados no projeto; evitar abstrações prematuras.
6. **Validar o comportamento** — executar testes e build após mudanças relevantes e, quando possível, testar com áudio real.
7. **Respeitar os dados do usuário** — não versionar modelos, builds, dependências instaladas, gravações ou resultados pessoais por acidente.
8. **Documentar o estado e as decisões** — manter README, ferramentas e changelog coerentes com o código entregue.

## Critérios para novas funcionalidades

- A funcionalidade resolve uma necessidade concreta do fluxo de transcrição?
- O usuário sabe onde o áudio e o texto são processados e salvos?
- A interface representa corretamente estados de espera, execução, sucesso e falha?
- A alteração evita expor caminhos locais ou dados sensíveis sem necessidade?
- Há validação automatizada adequada à mudança?

## Fora do escopo por padrão

- Upload automático de gravações ou transcrições.
- Coleta de telemetria com conteúdo do usuário.
- Inclusão de binários de terceiros, modelos de IA ou arquivos de áudio no primeiro plano do Git.
- Declarar histórico, exportação, configurações ou outros módulos concluídos antes de estarem implementados e testados.
