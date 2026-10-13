"""Placar de aprovação: status das peças lidos da pasta saida/ do escritório."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.brandforge import placar as placar_module
from app.brandforge.placar import STATUSES, collect_pieces, normalize_status, slugify
from app.main import app

DEBATE_APROVADO = """# Debate — Tema A

# Tentativa 1

## Proposta v1 — Tema A

## Crítica — rodada 3

### Veredito
APROVADA
"""

DEBATE_REPROVADO = """# Debate — Tema B

# Tentativa 1

## Crítica — rodada 3

### Veredito
REPROVADA
"""

DEBATE_EM_ANDAMENTO = """# Debate — Tema C

# Tentativa 1

## Proposta v1 — Tema C

## Crítica — rodada 1

### Objeções
R1.1 [menor] (Público) — algo.
"""

DEBATE_COM_STATUS = """# Debate — Automação para clínicas

# Tentativa 1

## Crítica — rodada 3

### Veredito
APROVADA COM RESSALVAS

Proposta aprovada: v3. Status: **pendente**. O usuário ainda não liberou a produção.
"""


@pytest.fixture
def saida(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    pasta = tmp_path / "saida"
    pasta.mkdir()
    monkeypatch.setattr(placar_module, "saida_dir", lambda: pasta)
    return pasta


def _peca(saida: Path, nome: str, **arquivos: str) -> Path:
    pasta = saida / nome
    pasta.mkdir()
    for arquivo, conteudo in arquivos.items():
        (pasta / arquivo.replace("__", ".")).write_text(conteudo, encoding="utf-8")
    return pasta


def _por_id(saida: Path) -> dict[str, dict[str, str]]:
    return {p["id"]: p for p in collect_pieces()}  # type: ignore[misc]


# --- normalização ------------------------------------------------------------------------------


def test_os_seis_status_do_protocolo() -> None:
    assert STATUSES == ["pendente", "em produção", "entregue", "aprovado", "refazer", "travado"]


@pytest.mark.parametrize(
    ("bruto", "esperado"),
    [
        ("pendente", "pendente"),
        ("**Pendente**", "pendente"),
        ("Em produção", "em produção"),
        ("em producao", "em produção"),
        ("EM PRODUÇÃO.", "em produção"),
        ("entregue", "entregue"),
        (" aprovado ", "aprovado"),
        ("refazer", "refazer"),
        ("Travado", "travado"),
        ("qualquer coisa", None),
        ("", None),
        (None, None),
    ],
)
def test_normalize_status(bruto: str | None, esperado: str | None) -> None:
    assert normalize_status(bruto) == esperado


def test_slugify_ignora_acento_e_pontuacao() -> None:
    assert slugify("Automação para Clínicas!") == "automacao-para-clinicas"


# --- status vindos das pastas ------------------------------------------------------------------


def test_resumo_com_status_entregue(saida: Path) -> None:
    _peca(
        saida,
        "2026-10-08_brandforge-em-15s",
        resumo__md=(
            "# Brandforge em 15s — 2026-10-08\n\n"
            "- Formato: motion graphic · Pilar: Marca · Status: entregue\n"
        ),
        final__mp4="x",
    )
    peca = _por_id(saida)["2026-10-08_brandforge-em-15s"]
    assert peca["status"] == "entregue"
    assert peca["tema"] == "Brandforge em 15s"
    assert peca["origem"] == "pasta"


def test_titulo_do_resumo_perde_o_prefixo_resumo(saida: Path) -> None:
    _peca(
        saida,
        "2026-10-12_edicao",
        resumo__md="""# Resumo: Reel gravado "Seu site abre?" (teste)

- Status: entregue
""",
    )
    assert _por_id(saida)["2026-10-12_edicao"]["tema"] == 'Reel gravado "Seu site abre?" (teste)'


def test_resumo_prevalece_sobre_o_debate(saida: Path) -> None:
    _peca(
        saida,
        "2026-10-01_a",
        debate__md=DEBATE_APROVADO,
        resumo__md="# A — 2026-10-01\n\n- Status: aprovado\n",
    )
    assert _por_id(saida)["2026-10-01_a"]["status"] == "aprovado"


def test_debate_aprovado_sem_producao_fica_pendente(saida: Path) -> None:
    _peca(saida, "2026-10-02_a", debate__md=DEBATE_APROVADO)
    assert _por_id(saida)["2026-10-02_a"]["status"] == "pendente"


def test_debate_aprovado_com_producao_em_andamento(saida: Path) -> None:
    _peca(saida, "2026-10-02_b", debate__md=DEBATE_APROVADO, roteiro__md="roteiro")
    assert _por_id(saida)["2026-10-02_b"]["status"] == "em produção"


def test_linha_de_status_no_debate_vale(saida: Path) -> None:
    _peca(saida, "2026-10-07_automacao-para-clinicas", debate__md=DEBATE_COM_STATUS)
    peca = _por_id(saida)["2026-10-07_automacao-para-clinicas"]
    assert peca["status"] == "pendente"
    assert peca["tema"] == "Automação para clínicas"


def test_debate_em_andamento_esta_em_producao(saida: Path) -> None:
    _peca(saida, "2026-10-03_c", debate__md=DEBATE_EM_ANDAMENTO)
    assert _por_id(saida)["2026-10-03_c"]["status"] == "em produção"


def test_tres_reprovacoes_travam_o_tema(saida: Path) -> None:
    texto = "# Debate — Tema D\n"
    for n in (1, 2, 3):
        texto += f"\n# Tentativa {n}\n\n## Crítica — rodada 3\n\n### Veredito\nREPROVADA\n"
    _peca(saida, "2026-10-04_d", debate__md=texto)
    assert _por_id(saida)["2026-10-04_d"]["status"] == "travado"


def test_uma_reprovacao_ainda_nao_trava(saida: Path) -> None:
    _peca(saida, "2026-10-05_b", debate__md=DEBATE_REPROVADO)
    assert _por_id(saida)["2026-10-05_b"]["status"] == "em produção"


def test_video_gravado_sem_debate_com_final_e_entregue(saida: Path) -> None:
    _peca(saida, "2026-10-12_edicao", final__mp4="x", legendas__md="l", resumo__md="# Edição\n")
    assert _por_id(saida)["2026-10-12_edicao"]["status"] == "entregue"


def test_pasta_vazia_ou_de_apoio_e_ignorada(saida: Path) -> None:
    (saida / "_amostras-voz").mkdir()
    (saida / "cronograma-2026-10-08").mkdir()
    (saida / "arquivo-solto.txt").write_text("x", encoding="utf-8")
    assert collect_pieces() == []


# --- status.json -------------------------------------------------------------------------------


def test_status_json_sobrescreve_o_derivado(saida: Path) -> None:
    _peca(saida, "2026-10-06_e", debate__md=DEBATE_APROVADO)
    (saida / "status.json").write_text(
        json.dumps(
            {
                "pecas": [
                    {
                        "id": "2026-10-06_e",
                        "status": "refazer",
                        "motivo": "o gancho ficou lento",
                        "formato": "reel",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    peca = _por_id(saida)["2026-10-06_e"]
    assert peca["status"] == "refazer"
    assert peca["motivo"] == "o gancho ficou lento"
    assert peca["formato"] == "reel"
    assert peca["origem"] == "status.json"


def test_status_json_cria_peca_sem_pasta(saida: Path) -> None:
    (saida / "status.json").write_text(
        json.dumps({"pecas": [{"id": "tema-solto", "tema": "Tema solto", "status": "pendente"}]}),
        encoding="utf-8",
    )
    assert _por_id(saida)["tema-solto"]["tema"] == "Tema solto"


def test_status_json_invalido_nao_quebra(saida: Path) -> None:
    _peca(saida, "2026-10-06_f", debate__md=DEBATE_APROVADO)
    (saida / "status.json").write_text("{ isto não é json", encoding="utf-8")
    assert _por_id(saida)["2026-10-06_f"]["status"] == "pendente"


def test_status_desconhecido_no_json_e_ignorado(saida: Path) -> None:
    _peca(saida, "2026-10-06_g", debate__md=DEBATE_APROVADO)
    (saida / "status.json").write_text(
        json.dumps({"pecas": [{"id": "2026-10-06_g", "status": "voando"}]}), encoding="utf-8"
    )
    assert _por_id(saida)["2026-10-06_g"]["status"] == "pendente"


# --- cronograma.md -----------------------------------------------------------------------------

CRONOGRAMA = """# Cronograma

| Dia | Tema | Formato | Pilar | Status |
| --- | --- | --- | --- | --- |
| 14/10 | Os vazamentos de pacientes | carrossel | Automações | **pendente** |
| 15/10 | Site que não abre no celular | reel | Sites | em produção |
| 16/10 | Agente de WhatsApp na prática | reel | Agentes | Travado |
| 17/10 | Tema sem status | post | Marca | |
"""


def test_cronograma_vira_pecas_pendentes(saida: Path) -> None:
    (saida / "cronograma.md").write_text(CRONOGRAMA, encoding="utf-8")
    pecas = collect_pieces()
    temas = {p["tema"]: p for p in pecas}
    assert temas["Os vazamentos de pacientes"]["status"] == "pendente"
    assert temas["Os vazamentos de pacientes"]["formato"] == "carrossel"
    assert temas["Os vazamentos de pacientes"]["origem"] == "cronograma"
    assert temas["Site que não abre no celular"]["status"] == "em produção"
    assert temas["Agente de WhatsApp na prática"]["status"] == "travado"
    assert temas["Tema sem status"]["status"] == "pendente"  # sem status = ainda não rodou


def test_tema_do_cronograma_com_pasta_nao_duplica(saida: Path) -> None:
    (saida / "cronograma.md").write_text(CRONOGRAMA, encoding="utf-8")
    _peca(
        saida,
        "2026-10-15_site-que-nao-abre-no-celular",
        resumo__md="# Site que não abre no celular — 2026-10-15\n\n- Status: entregue\n",
    )
    pecas = [p for p in collect_pieces() if "celular" in p["tema"].lower()]
    assert len(pecas) == 1
    assert pecas[0]["status"] == "entregue"
    assert pecas[0]["origem"] == "pasta"


def test_cronograma_sem_coluna_de_status_e_ignorado(saida: Path) -> None:
    (saida / "cronograma.md").write_text(
        "| Dia | Tema |\n| --- | --- |\n| 1 | X |\n", encoding="utf-8"
    )
    assert collect_pieces() == []


# --- rota --------------------------------------------------------------------------------------


def test_rota_placar_conta_por_status_e_destaca_travados(saida: Path) -> None:
    texto = "# Debate — Tema D\n"
    for n in (1, 2, 3):
        texto += f"\n# Tentativa {n}\n\n## Crítica — rodada 3\n\n### Veredito\nREPROVADA\n"
    _peca(saida, "2026-10-04_d", debate__md=texto)
    _peca(saida, "2026-10-02_a", debate__md=DEBATE_APROVADO)
    body = TestClient(app).get("/api/v1/brandforge/placar").json()
    assert body["statuses"] == STATUSES
    assert body["counts"]["travado"] == 1
    assert body["counts"]["pendente"] == 1
    assert body["counts"]["entregue"] == 0
    assert {p["id"] for p in body["pieces"]} == {"2026-10-04_d", "2026-10-02_a"}
    assert body["locked"] == ["2026-10-04_d"]


def test_rota_placar_sem_pasta_devolve_vazio(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(placar_module, "saida_dir", lambda: tmp_path / "nao-existe")
    body = TestClient(app).get("/api/v1/brandforge/placar").json()
    assert body["pieces"] == []
    assert all(v == 0 for v in body["counts"].values())
