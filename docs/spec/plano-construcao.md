# Plano de construção do Escritório de Agentes BrandForge

> **Para o Claude Code:** este arquivo é o roteiro de construção do projeto e a memória entre sessões. Cada sessão executa **uma fase**. Comece sempre pela seção "Estado", leia o "Contexto que não está nos prompts" e execute a próxima fase pendente. Ao terminar, atualize este arquivo antes de parar.
>
> **Para o Silvestre:** em cada sessão nova, rode `/clear` e depois `/proxima-fase`. Nada mais.

---

## Estado

| Fase | Assunto | Status | Observações |
| --- | --- | --- | --- |
| 0 | Preparação do ambiente | concluída | HyperFrames roda nativo no Windows; rtk instalado (ganho pequeno, ver contexto) |
| 1 | Especificação e marca | concluída | `docs/spec/escritorio-brandforge.md`, `marca/frame.md` |
| 2 | Agentes e conhecimento | concluída | 11 agentes, validador `validar-fase2.mjs`, teste de debate aprovado |
| 3 | Fábrica de vídeos e posts | concluída | Blocos BrandForge, som sintetizado, /produzir; peça de teste `saida/2026-10-08_brandforge-em-15s/` |
| 3b | Narração (extra, pedida pelo Silvestre) | concluída | Voz Piper `faber-medium` local, alinhada com whisper; `/produzir` narra por padrão; peça de teste `saida/2026-10-08_brandforge-com-voz/` |
| 4 | Editor de Vídeo | concluída | Aprovado pelo Revisor (ciclo 2) e confirmado pelo Silvestre em 12/10. Peça de teste `saida/2026-10-12_site-que-nao-abre-no-celular/`; scripts em `pipeline/editor/`, comando `/editar` |
| 5 | Escritório visual | confirmar | Feita em 12/10 no fork `brandforge-office` (ramo `fase-5-escritorio`, já na `main`, sem push); falta o Silvestre abrir o escritório e conversar com o Orquestrador. Ver `docs/brandforge/README.md` no fork |
| 6 | Drive, cronograma e memória | pendente | Precisa do caminho da pasta do Google Drive |
| 7 | Primeiro vídeo e medição | pendente | Gera o relatório de consumo |

### Diário de fases

<!-- Ao terminar cada fase, acrescente aqui: data, o que foi feito, decisões tomadas, pendências e o consumo medido com ccusage. Mantenha cada entrada curta. -->

- **08/10, Fases 3 e 3b:** fábrica HyperFrames pronta e narração adicionada a pedido do Silvestre. Decisões da 3b: Piper como ferramenta local (GPL-3.0, sem distribuir); "BrandForge" corrigido só no dicionário do TTS (`fabrica/audio/voz/pronuncias.json`), a legenda mantém a grafia do roteiro; pausa mínima de 1,0 s depois do gancho, ganchos narrados com menos de cerca de 1,5 s são recusados; hyperframes 0.8.141 no alinhador e 0.8.140 na fábrica (unificar depois). Bug corrigido: destaque da legenda a cada 2 ou 3 blocos. Ao fim da 3b, a semana estava em 76% do limite.

- **12/10, Fase 4 (Editor de Vídeo):** `pipeline/editor/` (Python + Node, 17 módulos, `FLUXO.md` com as 12 etapas), `/editar`, `validar-fase4.mjs`, 109 testes Python e 13 Node. Teste real: gravação de celular de 150 s (HLG/HDR, muitas regravações) virou um Reel de 26 s com os três layouts, legendas, CTA e som; Revisor: CORRIGIR no ciclo 1, APROVADO no 2 (`revisao.md`, `resumo.md`). Decisões: transcrição por trecho de fala (whisper local, tempos pela energia) porque o whisper sozinho espalhava palavras por silêncios; proxy da câmera sempre SDR bt709 (fonte HDR derrubava o render num caminho em camadas que ignora máscaras); layout dividido com fonte vertical a 1080 px (cabeça grande, gráfico acima de y ~680); o agente corrige o texto das legendas comparando tomadas (campo `legenda`), sem ouvir; render com temporários no disco D: (o C: estava cheio). Defeitos que só a varredura quadro a quadro (`pipeline.editor.verificar`) pega: limites de clipe arredondados deixavam 1 quadro vazio. Consumo medido (ccusage, 12/10, só a sessão desta fase, sonnet-5-5): 345 mil tokens de saída, 95,6 milhões no total (94,6 milhões de leitura de cache), ~US$ 15,50 estimados; fora, os subagentes (copywriter e dois ciclos do revisor, ~340 mil tokens de subagente) e o fim da sessão; a semana estava em 76% ao fim da Fase 3b.

- **12/10, Fase 5 (Escritório visual):** feita no fork (`brandforge-office`), em 7 commits. Pronto: `iniciar-escritorio.ps1` (backend e frontend só em 127.0.0.1, resumos com IA desligados, abre o navegador com o token) e `instalar-hooks-escritorio.ps1` (hooks só em `.claude/settings.json` deste projeto, executável no `.venv` do fork); elenco fixo dos 11 agentes (nome, cor e cartão com função e inspiração; o chefe da sessão do escritório é o Orquestrador); chat com o Orquestrador (`claude -p --agent orquestrador --output-format stream-json --resume`, prompt pelo stdin, cada fala vira mensagem e balão); debate em balões, rodada por rodada, lido do `debate.md`; placar com os 6 status (quadro Kanban em tela cheia e modo Kanban do quadro branco). Decisões: (1) hooks com `"shell": "powershell"` e `& "caminho" evento`, porque o Claude Code aberto pelo chat não achou o Git Bash e o hook em bash falhava; (2) não existia arquivo de status, então o placar lê o que o pipeline já escreve (`saida/cronograma.md`, `debate.md`, `resumo.md`) e aceita um `saida/status.json` opcional que sobrescreve tudo (contrato no README do fork); (3) chat em modo não interativo com `--permission-mode acceptEdits`: o que não estiver liberado no `settings.json` do escritório é negado; (4) o POST do chat exige o token da sessão (o link que o script abre já o traz); (5) textos novos da interface em português direto no código, fora do i18n; (6) a revisão final foi minha (sem subagente, para poupar limite). Testado de verdade: 2 mensagens reais ao Orquestrador (resposta e continuação da sessão, ~US$ 0,13) e o debate real de `2026-10-07_automacao-para-clinicas`; agentes com cartão e placar com travado foram vistos com eventos simulados e uma pasta de teste (não rodei um `/produzir` de verdade). Testes: backend 495, hooks 33, frontend 210, tudo verde (3 testes de `path_utils` que já falhavam no Windows foram corrigidos). Consumo medido (ccusage, 12/10, só a sessão desta fase, sonnet-5-5): 196 mil tokens de saída, 58,8 milhões no total (58,2 milhões de leitura de cache), ~US$ 9,44 estimados; mais ~US$ 0,13 do Orquestrador (Opus) nos testes do chat; o ccusage não mostra a porcentagem da semana.

---

## Como executar uma fase

1. Leia a seção "Estado" e escolha a **primeira fase não concluída**. Se a fase anterior estiver marcada "confirmar", verifique antes: commits, validador e o "Pronto quando" dela. Se estiver completa, marque como concluída; se faltar algo, termine o que falta primeiro.
2. Leia o "Contexto que não está nos prompts" e as fontes da verdade:
   - `docs/spec/escritorio-brandforge.md` (especificação)
   - `docs/spec/prompts-midia.md` (textos dos agentes de mídia e das skills de manual)
   - `marca/DESIGN.md`, `marca/brandforge.md`, `marca/frame.md`
3. Execute o prompt da fase com o Superpowers. Use **executing-plans** por padrão (economiza limites da assinatura Pro). Use subagent-driven-development só se a fase tiver muitas tarefas independentes e você explicar o motivo.
4. **Autonomia:** só pare para perguntar ao Silvestre quando houver um bloqueio real (uma informação que só ele tem ou uma decisão que não pode ser desfeita). Junte todas as perguntas numa única mensagem. No resto, decida, registre a decisão no diário e siga.
5. Commit ao fim de cada tarefa, em português, **sem push**. O Silvestre faz o push pelo GitHub Desktop.
6. Ao terminar a fase:
   - confira o checklist "Pronto quando";
   - rode `npx ccusage@latest` e anote o consumo da fase;
   - atualize a tabela "Estado" e acrescente a entrada no "Diário de fases";
   - registre novas pendências na seção "Pendências";
   - faça o commit da atualização deste arquivo;
   - mostre ao Silvestre um resumo curto: o que ficou pronto, o que depende dele e o consumo;
   - termine dizendo para ele rodar `/clear` e `/proxima-fase` na próxima sessão.
7. **Não emende duas fases na mesma sessão.** O contexto limpo entre fases economiza tokens.
8. Se o limite da assinatura acabar no meio: o trabalho está salvo nos commits. Na retomada, a sessão confere os commits e continua da próxima tarefa.

---

## Contexto que não está nos prompts

### O projeto
- Escritório de marketing para redes sociais (Instagram e TikTok) da BrandForge, 100% autônomo. O Silvestre só dá ideias ou pede cronogramas e, no fim, dá feedback; posta manualmente.
- Três entradas: ideia do usuário, cronograma e vídeo gravado pelos sócios (Silvestre e Filipe).
- Saída: uma pasta por peça no Google Drive.
- Interface: fork do Claude Office com chat do Orquestrador, cartões dos agentes, debate em balões e placar.

### Arquitetura que já foi decidida
- **O Orquestrador é o agente da sessão principal**, iniciado com `claude --agent orquestrador`, porque subagentes não chamam outros subagentes. Os outros 10 são subagentes. O Entregador é um script.
- A skill `contexto-brandforge` diz a cada agente o que ler da marca.
- Os 6 agentes de mídia são gerados por `node pipeline/checagens/gerar-agentes-midia.mjs` a partir de `docs/spec/prompts-midia.md`. Para mudar um texto desses agentes, edite o `prompts-midia.md` e rode o gerador; nunca edite o agente direto.
- O `orquestrador.md` recebeu ajustes depois do plano da Fase 2: o arquivo é a fonte, não o plano.
- Status das peças: pendente, em produção, entregue, aprovado, refazer e **travado** (depois de 3 reprovações; aparece no placar e o `/rodar` pula).
- Vídeos e posts com **HyperFrames** (o Remotion foi descartado). Música e efeitos sintetizados por código. Sem imagens, vídeos ou música gerados por IA (sem MusicGen, sem Docker).
- **Exceção decidida pelo Silvestre em 08/10:** motion graphics têm narração por voz sintética local (Piper, voz `faber-medium`), declarada na proposta para o Crítico não tratá-la como falha. Vídeos gravados pelos sócios usam a voz real deles. Não trocar o motor de voz nem adicionar outra mídia gerada por IA sem pedido do Silvestre. O whisper-cpp é usado para transcrição e alinhamento.

### Regras da marca que valem em tudo
- O nome é sempre BrandForge.
- CTA sempre para o link na bio. Nunca número de WhatsApp, e-mail ou contato direto em peças ou legendas.
- Nunca inventar preços, números, resultados ou casos. Nunca citar serviços que a BrandForge não oferece.
- Os cinco projetos do portfólio em `marca/brandforge.md` são clientes reais.

### Ambiente
- Windows, VS Code, PowerShell. Git Bash disponível para a ferramenta Bash. O rtk só atua no Bash, por isso economiza pouco aqui; não migrar para WSL por causa dele.
- Pasta deste projeto: `escritorio_marketingBF`. O fork do Claude Office fica na pasta vizinha (confirme o nome com o Silvestre na Fase 5; a sugestão era `brandforge-office`).
- O Claude Code de linha de comando está instalado em `%USERPROFILE%\.local\bin` e está no PATH.
- Existe uma status line nas configurações de usuário mostrando contexto, cache, limites de 5 h e da semana e custo estimado.
- Dependências só dentro do projeto (npm na pasta, Python no `.venv`), nunca globais.

### Custo e limites
- Custo zero: tudo roda na assinatura **Claude Pro** do Silvestre. O Codex não está instalado; ficou como reserva.
- Medição real (07/10): um debate de 3 rodadas, só proposta e debate, consumiu cerca de **15% da janela de 5 h** e **10% da semana**. Uma peça completa deve custar várias vezes isso.
- Ideias de economia para avaliar **na Fase 7, com números reais** (não aplicar antes): debater o cronograma uma vez em vez de cada peça; Orquestrador em Sonnet mantendo o Crítico em Opus; Crítico lendo menos contexto; 2 rodadas para posts simples.
- Meta do Silvestre: uma peça por dia. Na Fase 7, diga com honestidade quantas peças por semana cabem no plano Pro.

---

## Pendências

- **Licença da voz (bloqueia publicar peças narradas):** o modelo `faber` foi afinado a partir da base `lessac`; ninguém confirmou se ela permite uso comercial. Antes de qualquer peça narrada ir ao Instagram, verificar a licença do modelo de voz e, se não permitir, trocar de voz ou de motor. Registrado em `fabrica/README.md`.
- **Pronúncia:** o Silvestre ainda não ouviu a voz. "BrandForge" hoje sai como "Brand Forj"; ajustar em `fabrica/audio/voz/pronuncias.json` conforme o feedback dele.
- Retenção: na peça de teste com voz, trechos de 2,00 a 2,48 s e 3,27 a 4,77 s ficam quase parados. Rever na próxima peça real.
- **Fase 4, resumo.md:** o Silvestre deu a fase como concluída em 12/10; os 8 itens de `saida/2026-10-12_site-que-nao-abre-no-celular/resumo.md` (ouvir, texto das legendas, a mão no fim, centro médico como demonstração, "Mongo…", capturas de celular, nota interna em `legendas.md`, fade dos trechos visuais) ficam como referência para o primeiro vídeo real, e o `relatorio.md` da peça ainda tem dois números imprecisos apontados pelo Revisor (§ 5 e § 9).
- **Fase 4, melhorias:** transcrição lenta (~8 min por 150 s; um whisper maior melhoraria o texto e custaria mais tempo); o proxy da câmera cobre o intervalo todo, não só os trechos usados (~4 min); o Editor não ouve, então o texto das legendas depende de conferência humana; `fabrica/projetos/site-celular/` e `.ferramentas/tmp-render/` são temporários recriáveis; o disco C: do PC está cheio (0 GB livres), libere espaço antes de renderizar muito.
- Limpeza: apagar o arquivo temporário `C:\Program Files\Git\tmp_riser.txt` (criado pelo Revisor fora do projeto) e os branches `fase-3-fabrica` local e remoto. O `render-mb.mjs` da peça de teste depende de um arquivo interno do HyperFrames 0.8.140.

- **Fase 5, o que falta o Silvestre fazer:** (a) reiniciar o Claude Code no escritório (`claude --agent orquestrador`) para os hooks valerem (já instalados e commitados aqui); (b) abrir o escritório com `iniciar-escritorio.ps1` (no fork) e conversar com o Orquestrador pelo botão Chat; (c) rodar um `/produzir` e ver os agentes com cartão, o debate e o placar; (d) dizer o que ajustar. Se a primeira conversa pedir uma permissão que o modo não interativo nega, liberar a ferramenta em `.claude/settings.json` ou mudar `BRANDFORGE_CHAT_PERMISSION_MODE` do backend.
- **Fase 6 (herdada da 5):** o Orquestrador e o Entregador devem gravar `saida/status.json` (`aprovado`, `refazer` e o motivo; formato no README do fork), senão o placar só enxerga pendente, em produção, entregue e travado. Quando o Drive entrar, o placar precisa ler o `cronograma.md` do Drive (hoje lê `saida/cronograma.md`) e `BRANDFORGE_OFFICE_DIR` continua apontando para este repositório.
- **Fase 5, limitações:** o chat mostra só as falas do Orquestrador (as dos subagentes aparecem nos balões e nos cartões); uma mensagem por vez; só o ambiente de dev (`next dev`) foi exercitado. O hook do plugin superpowers reclama de "Git Bash was not found" nas sessões abertas pelo chat (é do plugin, não atrapalha). Já existiam e continuam: 10 erros de lint do eslint no frontend (hooks do React) e 27 avisos do pyright em `hooks/`; os commits aparecem com acento quebrado no painel de Git do escritório (decodificação do `git_service`).
- **Disco C: sem espaço:** o `uv cache clean` foi rodado na Fase 5 e ainda assim ficou 0 byte livre (o `pytest`, o Chrome e o Claude Code escrevem em `%TEMP%` no C:). Libere espaço (o `Temp\claude` tem ~900 MB de sessões antigas, além de `bf_full`, `bf_frames`, `curta` de fases anteriores). Enquanto isso, rodar com `TEMP` e `TMP` apontando para uma pasta do D:.

- Pergunta do Orquestrador ainda sem resposta: a BrandForge consegue ligar o atendente com IA ao sistema de agenda da clínica? Até a resposta, nenhuma peça promete essa integração. O tema "Os vazamentos de pacientes" (carrossel, aprovado com ressalvas) está pendente em `saida/2026-10-07_automacao-para-clinicas/`.
- Itens menores da Fase 2: lógica duplicada entre gerador e validador; validador não confere a lista de agentes em `Agent(...)`; a regra dos "fatos que só os sócios sabem" ainda não foi exercitada na produção.
- Codex: instalar só se os limites apertarem e houver código pesado para delegar.

---

## Fase 4: Editor de Vídeo

**Depende do Silvestre:** uma gravação de teste de 1 a 2 minutos olhando para a câmera, numa pasta dentro de `entrada/` (de preferência com a voz gravada à parte, em lapela ou celular perto da boca). Se não houver gravação, peça antes de começar e pare.

```markdown
Fonte da verdade: a seção "Editor de Vídeo" de docs/spec/prompts-midia.md e as skills video-brandforge, som-brandforge e verificacao-video.

1. Instale só dentro do projeto o que o processo exige: transcrição com tempo por palavra (whisper-cpp, a do HyperFrames ou equivalente local), remoção de fundo local para o layout dividido e o ambiente virtual Python com NumPy e SciPy. Nada pago, nada global, nada de modelos que gerem mídia.
2. Implemente cada etapa do prompt do Editor como script reutilizável em pipeline/editor/: sincronização, transcrição, agrupamento de tomadas, cortes com J cut, checagem de contato visual, tabela de trechos, os três layouts, legendas, capa, cartão de CTA, áudio, montagem e renderização. O agente decide; os scripts executam.
3. Crie /editar em .claude/commands/: para cada pasta nova em entrada/, roda o Editor de Vídeo e depois o Revisor, entregando em saida/AAAA-MM-DD_tema/.
4. Teste com a gravação que está em entrada/. Mostre a tabela de trechos, a prancha de quadros e o relatório.
5. Commit ao fim de cada tarefa.
```

**Pronto quando**
- [x] Transcrição e remoção de fundo rodando localmente, sem custo
- [x] `/editar` gera `final.mp4` com os três layouts, legendas e som
- [x] Relatório com tomadas escolhidas, trechos e loudness
- [x] O Silvestre assistiu e anotou ajustes (confirmado em 12/10)

---

## Fase 5: Escritório visual

**Atenção:** esta fase roda no repositório do fork do Claude Office, não neste. Se a sessão atual estiver em `escritorio_marketingBF`, não execute: diga ao Silvestre para abrir o VS Code na pasta do fork, iniciar o Claude Code lá e rodar `/proxima-fase` (ou colar o prompt abaixo). Antes disso, copie este arquivo e o comando `/proxima-fase` para o fork, ou leia este arquivo pelo caminho `../escritorio_marketingBF/docs/spec/plano-construcao.md`. Ao terminar, atualize o "Estado" **neste** arquivo.

```markdown
Este repositório é um fork do Claude Office (Next.js + PixiJS + FastAPI + Zustand). O escritório de agentes fica na pasta vizinha ../escritorio_marketingBF. Leia a especificação em ../escritorio_marketingBF/docs/spec/escritorio-brandforge.md e o plano em ../escritorio_marketingBF/docs/spec/plano-construcao.md antes de planejar. Leia CLAUDE.md, AGENTS.md e docs/architecture deste repositório antes de mudar qualquer coisa.

Como o escritório funciona: o Orquestrador é o agente da sessão principal do Claude Code, iniciado em ../escritorio_marketingBF com claude --agent orquestrador. Os outros 10 agentes (em ../escritorio_marketingBF/.claude/agents/) são subagentes chamados por ele. O Entregador é um script, não um agente.

1. Instalação no Windows: faça o projeto rodar no PC. Onde o projeto depende de make ou tmux, crie um script iniciar-escritorio.ps1 que sobe backend e frontend. Desligue os resumos com IA (SUMMARY_BACKEND=disabled). Instale os hooks no Claude Code.
2. Personagens: a sessão principal aparece como o Orquestrador (o chefe) e cada subagente como um funcionário, identificado pelo nome do arquivo do agente. Ao clicar, mostre um cartão com nome, função e inspiração. Cada agente com cor fixa.
3. Chat com o Orquestrador: painel de chat na interface. O backend recebe a mensagem e a envia ao Claude Code em ../escritorio_marketingBF, sempre com --agent orquestrador e continuando a mesma sessão (modo não interativo com retomada de sessão; guarde o id da sessão). A resposta volta ao chat e aparece em balão sobre o Orquestrador. Escute só em localhost.
4. Debate em balões: o Crítico é chamado pelo Orquestrador como subagente. Mostre as objeções do Crítico e as respostas do Orquestrador em balões de fala, rodada por rodada.
5. Placar: adapte o modo Kanban do quadro branco para ler o status das peças (pendente, em produção, entregue, aprovado, refazer, travado) a partir do arquivo de status que o pipeline do escritório mantém.
6. Mantenha as funções originais do Claude Office funcionando. Rode os testes existentes e adicione testes para o que for novo.
7. Commit ao fim de cada tarefa.
```

**Pronto quando**
- [x] `iniciar-escritorio.ps1` sobe o escritório em `localhost:3000` (testado; o script abre o link com o token)
- [ ] Rodar `/produzir` mostra os agentes trabalhando com cartões (visto com eventos simulados no formato dos hooks; falta um `/produzir` de verdade)
- [ ] O Silvestre conversa com o Orquestrador pelo chat (testado por mim com mensagens reais; falta a conferência dele)
- [ ] O debate aparece em balões e o placar atualiza (visto com o debate real e com uma pasta de teste; falta ver numa peça nova)

---

## Fase 6: Drive, cronograma e memória

**Depende do Silvestre:** o Google Drive para computador instalado e a pasta `Brandforge` com as subpastas `Entregas` e `Entrada`. Pergunte o caminho da pasta antes de começar, se ainda não estiver em `config.json`.

```markdown
Fonte da verdade: docs/spec/escritorio-brandforge.md.

1. Configuração: crie config.json (fora do git, com um config.example.json versionado) com o caminho da pasta do Drive informado pelo Silvestre.
2. Entregador (script, sem IA): copia cada peça pronta de saida/ para Entregas/AAAA-MM-DD_tema/ no Drive, apaga os arquivos intermediários de renderização e atualiza o status da peça para "entregue" no arquivo de status lido pelo placar.
3. Entrada pelo Drive: o /editar passa a procurar vídeos novos também em Entrada/ no Drive e move para uma subpasta "processados" quando terminar.
4. Modo cronograma: comando /cronograma (Caçador de Tendências → Estrategista → Crítico) que gera cronograma.md no Drive com temas, formato e status. Comando /rodar que produz os próximos temas pendentes do cronograma (pulando os travados) e edita os vídeos novos de Entrada. Respeite edições feitas à mão no cronograma.md.
5. Memória de aprendizado: quando o Silvestre der feedback ao Orquestrador ("gostei", "refaça porque...", ou prints de estatísticas), o Analista registra em memoria/aprendizado.md e mantém a seção curta "Regras aprendidas" (no máximo 20 linhas). "Refaça" coloca a peça de volta no fluxo com o motivo.
6. Teste cada comando. Commit ao fim de cada tarefa.
```

**Pronto quando**
- [ ] Uma peça pronta aparece sozinha em `Entregas` no Drive
- [ ] `/cronograma` cria o arquivo e `/rodar` produz a partir dele
- [ ] Um feedback do Silvestre aparece em `memoria/aprendizado.md`

---

## Fase 7: Primeiro vídeo e medição

**Depende do Silvestre:** produzir a primeira peça real pelo escritório (pelo chat do Orquestrador) e dar o feedback. Depois disso, esta fase gera o relatório.

```markdown
A primeira peça completa foi produzida. Faça o relatório de consumo:

1. Use o ccusage para medir os tokens consumidos na produção, separando por modelo e, se possível, por agente.
2. Monte uma tabela: agente, modelo, tokens de entrada, tokens de saída, porcentagem do total. Inclua a porcentagem da janela de 5 h e da semana que a peça consumiu.
3. Diga quantas peças por semana cabem no plano Pro nessa configuração.
4. Avalie as ideias de economia da seção "Custo e limites" com os números reais e proponha um ajuste concreto para cada um dos 3 maiores gastos. Não aplique nada sem aprovação.
5. Salve em docs/relatorios/consumo-primeira-peca.md e faça commit.
```

**Pronto quando**
- [ ] Primeira peça real no Drive, com legendas para Instagram e TikTok
- [ ] Relatório de consumo salvo
- [ ] Ajustes escolhidos pelo Silvestre e aplicados
