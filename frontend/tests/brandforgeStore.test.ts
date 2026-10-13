/**
 * Testes do estado do escritório BrandForge: elenco e reconhecimento da sessão do escritório.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  samePath,
  useBrandforgeStore,
  type RosterEntry,
} from "@/stores/brandforgeStore";

const CRITICO: RosterEntry = {
  slug: "critico",
  name: "Crítico",
  role: "Ataca propostas",
  inspiration: "Steve Jobs (fase exigente)",
  model: "Opus",
  color: "#EF4444",
};

describe("samePath", () => {
  it("ignora barras, caixa e barra final", () => {
    expect(
      samePath(
        "D:\\Pc User\\Documents\\GitHub\\BrandForge\\escritorio_marketingBF",
        "d:/pc user/documents/github/brandforge/escritorio_marketingbf/",
      ),
    ).toBe(true);
  });

  it("pastas diferentes não batem", () => {
    expect(samePath("D:/a/b", "D:/a/c")).toBe(false);
    expect(samePath(null, "D:/a/b")).toBe(false);
    expect(samePath("D:/a/b", undefined)).toBe(false);
  });
});

describe("brandforgeStore", () => {
  beforeEach(() => {
    useBrandforgeStore.getState().reset();
  });

  it("setRoster indexa os agentes pelo slug", () => {
    useBrandforgeStore.getState().setRoster("D:/x/escritorio", [CRITICO]);
    expect(useBrandforgeStore.getState().bySlug("critico")?.name).toBe(
      "Crítico",
    );
    expect(useBrandforgeStore.getState().bySlug("nao-existe")).toBeNull();
    expect(useBrandforgeStore.getState().bySlug(null)).toBeNull();
  });

  it("reconhece a sessão do escritório pela pasta do projeto", () => {
    const s = useBrandforgeStore.getState();
    s.setRoster("D:\\x\\escritorio", [CRITICO]);
    s.setCurrentProjectRoot("d:/x/escritorio");
    expect(useBrandforgeStore.getState().isOfficeSession).toBe(true);
    useBrandforgeStore.getState().setCurrentProjectRoot("D:/outro/projeto");
    expect(useBrandforgeStore.getState().isOfficeSession).toBe(false);
  });

  it("a ordem das chamadas não importa (projeto antes do elenco)", () => {
    const s = useBrandforgeStore.getState();
    s.setCurrentProjectRoot("D:/x/escritorio");
    expect(useBrandforgeStore.getState().isOfficeSession).toBe(false);
    useBrandforgeStore.getState().setRoster("D:/x/escritorio", [CRITICO]);
    expect(useBrandforgeStore.getState().isOfficeSession).toBe(true);
  });
});
