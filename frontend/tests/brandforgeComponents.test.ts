/**
 * Renderização dos componentes do escritório BrandForge (cartão, debate, chat), sem navegador:
 * renderToString com o estado já carregado nos stores.
 */

// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";
import AgentCard from "@/components/brandforge/AgentCard";
import ChatPanel from "@/components/brandforge/ChatPanel";
import DebatePanel from "@/components/brandforge/DebatePanel";
import PlacarBoard from "@/components/brandforge/PlacarBoard";
import { usePlacarStore } from "@/stores/placarStore";
import { useChatStore } from "@/stores/chatStore";
import { useDebateStore, type Debate } from "@/stores/debateStore";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** Renderiza no DOM (happy-dom) e devolve o HTML. O zustand só reflete setState fora do SSR. */
function renderToString(element: ReactElement): string {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  const html = container.innerHTML;
  act(() => {
    root.unmount();
  });
  container.remove();
  return html;
}

const DEBATE: Debate = {
  piece: "2026-10-07_tema",
  title: "Automação para clínicas",
  kind: "peca",
  verdict: "REPROVADA",
  state: "reprovada",
  currentRound: 1,
  updatedAt: null,
  attempts: [
    {
      number: 1,
      proposals: [{ version: 1, title: "Tema" }],
      verdict: "REPROVADA",
      verdictNotes: ["R1.2 (fatal): promete o que não existe."],
      rounds: [
        {
          round: 1,
          objections: [
            {
              id: "R1.1",
              gravity: "séria",
              criterion: "Gancho",
              text: "O gancho entrega a resposta.",
              reason: "porque sim",
              fix: "mudar",
            },
            {
              id: "R1.2",
              gravity: "fatal",
              criterion: "Marca",
              text: "Promete integração.",
              reason: "",
              fix: "",
            },
          ],
          answers: [
            { ids: ["R1.1"], action: "ACEITAR", text: "Troquei o gancho." },
          ],
          statuses: [],
        },
      ],
    },
  ],
};

describe("AgentCard", () => {
  it("mostra nome, função, inspiração e modelo do agente", () => {
    const html = renderToString(
      createElement(AgentCard, {
        entry: {
          slug: "critico",
          name: "Crítico",
          role: "Ataca propostas em 3 rodadas",
          inspiration: "Steve Jobs (fase exigente)",
          model: "Opus",
          color: "#EF4444",
        },
        state: "working",
        task: "rodada 2",
      }),
    );
    expect(html).toContain("Crítico");
    expect(html).toContain("Ataca propostas em 3 rodadas");
    expect(html).toContain("Steve Jobs (fase exigente)");
    expect(html).toContain("Opus");
    expect(html).toContain("rodada 2");
    expect(html).toContain("#EF4444");
  });
});

describe("DebatePanel", () => {
  beforeEach(() => {
    useDebateStore.getState().reset();
  });

  it("sem debate, explica o que vai aparecer", () => {
    const html = renderToString(createElement(DebatePanel));
    expect(html).toContain("Nenhum debate ainda");
  });

  it("mostra balões do Crítico e do Orquestrador, rodada por rodada", () => {
    useDebateStore.setState({ debate: DEBATE, available: [] });
    const html = renderToString(createElement(DebatePanel));
    expect(html).toContain("Rodada 1");
    expect(html.match(/data-testid="balloon-critic"/g)).toHaveLength(2);
    expect(html.match(/data-testid="balloon-orquestrador"/g)).toHaveLength(1);
    expect(html).toContain("O gancho entrega a resposta.");
    expect(html).toContain("Troquei o gancho.");
    expect(html).toContain("séria");
    expect(html).toContain("fatal");
    expect(html).toContain("ACEITAR");
  });

  it("mostra o veredito e as ressalvas", () => {
    useDebateStore.setState({ debate: DEBATE, available: [] });
    const html = renderToString(createElement(DebatePanel));
    expect(html).toContain("Veredito: REPROVADA");
    expect(html).toContain("promete o que não existe");
  });

  it("o Crítico vem antes do Orquestrador dentro da rodada", () => {
    useDebateStore.setState({ debate: DEBATE, available: [] });
    const html = renderToString(createElement(DebatePanel));
    expect(html.indexOf("balloon-critic")).toBeLessThan(
      html.indexOf("balloon-orquestrador"),
    );
  });
});

describe("ChatPanel", () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it("sem mensagens, mostra a orientação inicial", () => {
    const html = renderToString(createElement(ChatPanel));
    expect(html).toContain("Converse com o Orquestrador");
  });

  it("mostra as mensagens e o aviso de trabalho em andamento", () => {
    useChatStore.setState({
      busy: true,
      messages: [
        { id: 1, role: "usuario", text: "faça um reel", timestamp: "" },
        {
          id: 2,
          role: "orquestrador",
          text: "Vou propor uma peça.",
          timestamp: "",
        },
      ],
    });
    const html = renderToString(createElement(ChatPanel));
    expect(html).toContain("faça um reel");
    expect(html).toContain("Vou propor uma peça.");
    expect(html).toContain("Orquestrador trabalhando");
  });

  it("com o Orquestrador trabalhando, o botão vira 'Parar e nova conversa'", () => {
    useChatStore.setState({ busy: true });
    expect(renderToString(createElement(ChatPanel))).toContain(
      "Parar e nova conversa",
    );
    useChatStore.setState({ busy: false });
    expect(renderToString(createElement(ChatPanel))).toContain("Nova conversa");
  });

  it("mostra o erro, quando há", () => {
    useChatStore.setState({ error: "O chat precisa do token da sessão." });
    const html = renderToString(createElement(ChatPanel));
    expect(html).toContain("O chat precisa do token da sessão.");
  });
});

describe("PlacarBoard", () => {
  beforeEach(() => {
    usePlacarStore.getState().reset();
  });

  const peca = (id: string, status: string, tema: string, motivo = "") => ({
    id,
    tema,
    formato: "reel",
    status,
    motivo,
    origem: "pasta",
    atualizadoEm: "2026-10-12T00:00:00Z",
  });

  it("mostra as seis colunas com a contagem de cada uma", () => {
    usePlacarStore.setState({
      loaded: true,
      statuses: null,
      pieces: [
        peca("a", "pendente", "Tema A"),
        peca("b", "pendente", "Tema B"),
        peca("c", "aprovado", "Tema C"),
      ],
    });
    const html = renderToString(
      createElement(PlacarBoard, { onClose: () => {} }),
    );
    for (const status of [
      "pendente",
      "em produção",
      "entregue",
      "aprovado",
      "refazer",
      "travado",
    ]) {
      expect(html).toContain(`data-testid="column-${status}"`);
    }
    expect(html).toContain("Tema A");
    expect(html).toContain("Tema C");
  });

  it("destaca o tema travado e pede a decisão do Silvestre", () => {
    usePlacarStore.setState({
      loaded: true,
      pieces: [peca("t", "travado", "Tema travado")],
    });
    const html = renderToString(
      createElement(PlacarBoard, { onClose: () => {} }),
    );
    expect(html).toContain('data-testid="piece-locked"');
    expect(html).toContain("nova ideia, editar o tema ou descartar");
  });

  it("mostra o motivo de uma peça para refazer", () => {
    usePlacarStore.setState({
      loaded: true,
      pieces: [peca("r", "refazer", "Tema R", "o gancho ficou lento")],
    });
    const html = renderToString(
      createElement(PlacarBoard, { onClose: () => {} }),
    );
    expect(html).toContain("o gancho ficou lento");
  });

  it("sem peças, orienta a falar com o Orquestrador", () => {
    usePlacarStore.setState({ loaded: true, pieces: [] });
    const html = renderToString(
      createElement(PlacarBoard, { onClose: () => {} }),
    );
    expect(html).toContain("Nenhuma peça ainda");
  });
});
