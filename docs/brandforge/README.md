# Escritório visual da BrandForge

Este fork do Claude Office mostra o escritório de agentes da BrandForge (repositório irmão
`escritorio_marketingBF`) como um escritório em pixel art: o Orquestrador é o chefe, cada
subagente é um funcionário, e há chat, debate em balões e um placar de aprovação.

O fork **não contém agentes nem produção**: ele só observa o Claude Code por hooks e lê a pasta
`saida/` do escritório. Tudo o que é específico da BrandForge fica em:

| Onde | O quê |
| --- | --- |
| `backend/app/brandforge/` | elenco, chat, debate, placar |
| `backend/app/api/routes/brandforge.py` | rotas `/api/v1/brandforge/...` |
| `frontend/src/components/brandforge/` | doca (Chat, Debate, Placar), cartões, painéis |
| `frontend/src/stores/{brandforge,chat,debate,placar}Store.ts` | estado da interface |
| `iniciar-escritorio.ps1`, `instalar-hooks-escritorio.ps1` | uso no Windows (sem make nem tmux) |

## Subir o escritório

```powershell
# uma vez: instala os hooks só no projeto do escritório (nada global)
.\instalar-hooks-escritorio.ps1

# sempre: sobe backend (:8000) e frontend (:3000) e abre o navegador
.\iniciar-escritorio.ps1
.\iniciar-escritorio.ps1 -Parar        # desliga
```

- Backend e frontend escutam só em `127.0.0.1`. Os resumos com IA ficam desligados
  (`SUMMARY_BACKEND=disabled`), então o escritório não gasta a assinatura.
- O navegador abre com `?token=...`: é a chave da sessão, sem ela o chat é recusado (o chat roda o
  Claude Code, então precisa de autorização). Os logs ficam em `.escritorio\logs\`.
- Depois de instalar os hooks, **reinicie o Claude Code** no escritório
  (`claude --agent orquestrador`) para os hooks valerem.

### Como os hooks funcionam aqui

O `instalar-hooks-escritorio.ps1` grava os hooks em `escritorio_marketingBF\.claude\settings.json`
(não em `~\.claude`), apontando para o executável do `.venv` de `hooks\`. Cada hook usa
`"shell": "powershell"` e `& "caminho" evento`, então o Claude Code **não precisa achar o Git
Bash**. A variável `CLAUDE_OFFICE_STRIP_PREFIXES` faz o painel mostrar o projeto como
`escritorio-marketingBF`. Para remover: `.\instalar-hooks-escritorio.ps1 -Remover`.

## O que aparece na tela

- **Personagens.** A sessão do escritório tem o Orquestrador como chefe (dourado). Cada subagente
  é identificado pelo nome do arquivo do agente (`critico`, `roteirista`...) e tem nome e cor fixos
  (`backend/app/brandforge/roster.py`). Clique no personagem para ver o cartão: nome, função,
  inspiração e modelo.
- **Chat** (botão *Chat*). Fala com o Orquestrador. O backend roda
  `claude -p --agent orquestrador --output-format stream-json --resume <id>` na pasta do escritório;
  cada fala dele chega ao chat assim que sai e aparece em balão sobre o chefe. A mesma conversa
  continua entre mensagens (o id da sessão fica em `backend/brandforge_chat.json`, fora do git).
  *Nova conversa* zera o histórico e a sessão. Uma mensagem por vez.
- **Debate** (botão *Debate*). Lê `saida/<peça>/debate.md` e mostra, rodada por rodada, as objeções
  do Crítico (com gravidade e critério), as respostas do Orquestrador (ACEITAR, REBATER, ASSUMIR
  RISCO) e o veredito. Também aparecem em balões sobre o Orquestrador e o Crítico quando eles estão
  no escritório.
- **Placar** (botão *Placar*, ou a tecla **K** no quadro branco). Os seis status — pendente, em
  produção, entregue, aprovado, refazer, travado. Temas travados ficam em vermelho e contam no
  botão: é o Silvestre quem decide (nova ideia, editar o tema ou descartar).

Links diretos: `/?painel=chat`, `/?painel=debate`, `/?painel=placar`.

## De onde vem o status das peças

Não há banco de status; o placar lê os arquivos que o pipeline já mantém (do mais fraco para o
mais forte):

1. `saida/cronograma.md` — tabelas com colunas `Tema` e `Status` (e `Formato`, opcional).
2. `saida/<peça>/debate.md` — em debate = *em produção*; aprovado sem produção = *pendente*;
   3 tentativas reprovadas = *travado*. Uma linha `Status: ...` escrita pelo Orquestrador vale.
3. `saida/<peça>/resumo.md` — a linha `Status: entregue` do protocolo.
4. `saida/status.json` — sobrescreve tudo. É por aqui que o pipeline (Entregador, Orquestrador)
   registra `aprovado`, `refazer` e o motivo:

```json
{
  "pecas": [
    {"id": "2026-10-07_tema", "status": "refazer", "motivo": "o gancho ficou lento"},
    {"id": "tema-solto", "tema": "Tema sem pasta", "status": "pendente", "formato": "reel"}
  ]
}
```

## Configuração (variáveis de ambiente do backend)

| Variável | Padrão | Para quê |
| --- | --- | --- |
| `BRANDFORGE_OFFICE_DIR` | pasta irmã `escritorio_marketingBF` | onde está o escritório |
| `BRANDFORGE_CLAUDE_PATH` | `claude` | executável do Claude Code usado pelo chat |
| `BRANDFORGE_CHAT_PERMISSION_MODE` | `acceptEdits` | permissões do Claude Code no chat (modo não interativo não pode perguntar; o que não estiver liberado em `.claude/settings.json` do escritório é negado) |

## Testes

```powershell
cd backend;  uv run pytest          # inclui test_brandforge_*.py
cd hooks;    uv run pytest
cd frontend; npx vitest run         # inclui brandforge*.test.ts, chatStore, debateStore, placarStore
```

## Problemas conhecidos

- O disco **C:** do PC está cheio; o `pytest` e o Chrome escrevem em `%TEMP%`. Se aparecer
  "No space left on device", aponte `TEMP` e `TMP` para uma pasta do D: antes de rodar.
- O hook do plugin *superpowers* reclama de "Git Bash was not found" em sessões abertas sem o Git
  no PATH (ex.: as do chat). É do plugin, não do escritório, e não impede nada.
