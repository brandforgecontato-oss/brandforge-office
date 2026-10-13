# Escritório visual BrandForge: redesenho (Fase 5b)

**Status: implementado em 13/10/2026** (etapas 1, 2 e 3 concluídas e commitadas). O que mudou em relação ao desenho: o clique nos avatares exigiu corrigir o letterbox do canvas (classe `brandforge-canvas`), e as falas dos balões e dos estados foram traduzidas para português.

Aprovado pelo Silvestre em 13/10/2026 (conversa), com autorização para executar todas as etapas
sem novas confirmações.

## Objetivo

Hoje o escritório tem a cara do Claude Office original: pixel art escura, título "Claude Office
Visualizer", textos em inglês, painéis que não servem à BrandForge. O Silvestre quer algo **limpo e
moderno**, com a identidade da marca, em que dê para ver de relance quem está trabalhando em quê.

**Sucesso:** abrir o escritório e ver a BrandForge (nome, cores, fontes, português), sem restos do
Claude Office, com salas, avatares planos e o placar e o debate fáceis de ler.

## Decisões do Silvestre

- Estilo limpo e moderno, não pixel art. A imagem de referência (planta com várias salas, em pixel art)
  foi só inspiração.
- Centro da tela: **planta com salas**, desenhada por código no estilo plano.
- Personagens: **avatares planos** desenhados por código (sem imagens geradas).
- Marca: paleta Obsidian e Ouro de `marca/frame.md` (fundo `#17140F`, ouro `#D4AF6A`, creme
  `#F7F1E3`), Playfair Display nos títulos e Inter no resto.

## Abordagem (B: cena nova só para o escritório BrandForge)

A cena nova só aparece quando a sessão é a do escritório (`isOfficeSession`). As outras sessões
continuam com o `OfficeGame` original, intocado. Nada muda no backend, porque os agentes já chegam
com `agentType` (nome do arquivo do agente). Tudo novo fica em
`frontend/src/components/brandforge/scene/`.

### Etapa 1: casca (sai primeiro)

- Título "BrandForge Office" e `<title>` da página; idioma padrão português (as traduções pt-BR já
  existem).
- Tokens da marca: sobrescrever a escala `slate` e os laranjas do Tailwind por tons de Obsidian e Ouro,
  e carregar Playfair Display e Inter.
- Acentos quebrados no painel de Git: o backend lia a saída do git com a codificação do Windows.
- Avisos vermelhos "stop": o `stop` deixa de gerar aviso (dispara a cada fim de turno do Orquestrador).
- Painéis que não servem à BrandForge (Git Status, placa Safety) escondidos na sessão do escritório.
- O quadro branco abre direto no Placar na sessão do escritório.

### Etapa 2: planta e avatares

- Planta fixa com 6 salas em grade, ligadas por um corredor central: Orquestrador, debate (mesa
  redonda), pesquisa e estratégia, roteiro e texto, produção visual, revisão e entrega.
- Mapa `slug → sala + posto` no frontend (`layout.ts`). Testes: os 11 agentes têm posto e nenhum
  posto se sobrepõe.
- Avatar plano: círculo na cor do agente com iniciais e nome. Parado fica apagado; trabalhando fica
  aceso, com pulso e a linha da tarefa. Clicar abre o cartão do agente (já existe).
- Agentes fora do elenco aparecem numa área de "visitantes".
- Balões de fala e placar continuam como estão; o placar ganha também um painel na parede da sala do
  Orquestrador.

### Etapa 3: movimento e acabamento

- Sem A*: cada sala tem uma porta no corredor e o avatar anda em linhas retas pelas portas.
- Orquestrador e Crítico vão à sala de debate durante as rodadas e voltam ao posto.
- Transições suaves, detalhes finos e responsividade.

## Fora de escopo

Ilustrações geradas por IA, mudanças no backend do pipeline, as outras visões do Claude Office
(prédio, andar, centro de comando).

## Testes

Vitest para o mapa de postos, para os componentes novos e para o que mudar nos filtros. Backend: teste
da codificação do git. Conferência visual por captura de tela no Chrome, a cada etapa.

## Riscos

- O movimento dos avatares é a parte mais delicada (por isso é a última etapa).
- O gasto de limite: cada etapa é fechada e commitada antes da próxima.
