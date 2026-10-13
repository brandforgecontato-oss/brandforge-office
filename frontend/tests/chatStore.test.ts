/**
 * Testes do chat com o Orquestrador (store + texto do balão).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/utils/api";
import { useChatStore, bubbleTextFor } from "@/stores/chatStore";

const mockFetch = vi.mocked(apiFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const msg = (id: number, role: string, text: string) => ({
  id,
  role,
  text,
  timestamp: "2026-10-12T20:00:00Z",
});

describe("chatStore", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useChatStore.getState().reset();
  });

  it("fetchNew busca só o que veio depois do último id e junta sem repetir", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        busy: true,
        sessionId: "s1",
        messages: [msg(1, "usuario", "oi"), msg(2, "orquestrador", "Olá")],
      }),
    );
    await useChatStore.getState().fetchNew();
    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/v1/brandforge/chat?after=0",
    );
    expect(useChatStore.getState().busy).toBe(true);

    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        busy: false,
        sessionId: "s1",
        messages: [
          msg(2, "orquestrador", "Olá"),
          msg(3, "orquestrador", "Pronto"),
        ],
      }),
    );
    await useChatStore.getState().fetchNew();
    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/v1/brandforge/chat?after=2",
    );
    const ids = useChatStore.getState().messages.map((m) => m.id);
    expect(ids).toEqual([1, 2, 3]);
    expect(useChatStore.getState().busy).toBe(false);
  });

  it("backend fora do ar marca offline sem apagar o histórico", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        busy: false,
        sessionId: null,
        messages: [msg(1, "usuario", "oi")],
      }),
    );
    await useChatStore.getState().fetchNew();
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await useChatStore.getState().fetchNew();
    expect(useChatStore.getState().offline).toBe(true);
    expect(useChatStore.getState().messages).toHaveLength(1);
  });

  it("send envia a mensagem e marca ocupado", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: msg(1, "usuario", "faça um reel") }, 202),
    );
    const ok = await useChatStore.getState().send("faça um reel");
    expect(ok).toBe(true);
    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toBe("/api/v1/brandforge/chat");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ message: "faça um reel" });
    expect(useChatStore.getState().busy).toBe(true);
    expect(useChatStore.getState().messages[0].text).toBe("faça um reel");
  });

  it("send recusa mensagem em branco sem chamar o backend", async () => {
    const ok = await useChatStore.getState().send("   ");
    expect(ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("409 explica que o Orquestrador está ocupado", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ detail: "ocupado" }, 409));
    const ok = await useChatStore.getState().send("outra");
    expect(ok).toBe(false);
    expect(useChatStore.getState().error).toMatch(/trabalhando/i);
  });

  it("401 orienta a abrir o escritório pelo link com token", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ detail: "Invalid API key" }, 401),
    );
    const ok = await useChatStore.getState().send("oi");
    expect(ok).toBe(false);
    expect(useChatStore.getState().error).toMatch(/iniciar-escritorio/);
  });

  it("newConversation limpa tudo depois do DELETE", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        busy: false,
        sessionId: "s",
        messages: [msg(1, "usuario", "oi")],
      }),
    );
    await useChatStore.getState().fetchNew();
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok" }));
    await useChatStore.getState().newConversation();
    expect(mockFetch.mock.calls[1][1]?.method).toBe("DELETE");
    expect(useChatStore.getState().messages).toEqual([]);
  });
});

describe("bubbleTextFor", () => {
  it("usa a primeira frase", () => {
    expect(
      bubbleTextFor("Vou montar a proposta. Depois chamo o Crítico."),
    ).toBe("Vou montar a proposta.");
  });

  it("corta texto longo sem frase curta", () => {
    const longo = "palavra ".repeat(40);
    const out = bubbleTextFor(longo);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith("...")).toBe(true);
  });

  it("ignora marcação de markdown e quebras de linha", () => {
    expect(bubbleTextFor("**Pronto!**\n\nA peça está na pasta.")).toBe(
      "Pronto!",
    );
  });
});
