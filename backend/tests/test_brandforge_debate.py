"""Debate Orquestrador × Crítico: leitura do debate.md e rota /api/v1/brandforge/debate."""

import os
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.brandforge import debate as debate_module
from app.brandforge.debate import find_debates, parse_debate
from app.main import app

# Formato do protocolo-debate (trecho fiel do debate real de 2026-10-07, resumido).
DEBATE_MD = """# Debate — Automação para clínicas

Pedido do usuário (2026-10-07): carrossel sobre automação para clínicas.

# Tentativa 1

## Proposta v1 — Automação para clínicas
- Formato: carrossel (6 slides, 1080×1350)
- Pilar: Automações

## Crítica — rodada 1

### Critérios
| Critério | Passa? | Observação |
| --- | --- | --- |
| Público | sim | ok |

### Objeções
R1.1 [séria] (Gancho nos 3 primeiros segundos) — O slide 1 entrega a resposta inteira.
   Motivo concreto: o gancho põe a lista inteira no primeiro slide.
   O que resolveria: um slide 1 com uma única tensão.

R1.2 [fatal] (Identidade da marca) — Promete uma capacidade que ninguém confirmou.
   Motivo concreto: o slide 3 fala em ler a agenda.
   O que resolveria: tirar a promessa.

R1.3 [menor] (Viabilidade no HyperFrames) — Texto demais no slide 4,
   continua na linha seguinte da objeção.
   Motivo concreto: passa de 30 palavras.
   O que resolveria: cortar.

### Resposta do Orquestrador — rodada 1
R1.1 — ACEITAR: o slide 1 deixa de listar respostas.
R1.2 — REBATER: a integração existe, ver marca/brandforge.md §3.
R1.3 — ASSUMIR RISCO: mantenho o texto e corro o risco de ficar denso;
vale porque o slide é salvável.

## Proposta v2 — Automação para clínicas
- Formato: carrossel

## Crítica — rodada 2

### Status das objeções anteriores
- R1.1 — resolvida. O slide 1 virou uma cena única.
- R1.2 — mantida [fatal]. A resposta não traz fonte.
- R1.3 — risco aceito. Texto denso, mas salvável.

### Objeções
R2.1 [séria] (Originalidade) — A tese não cobre dois slides.
   Motivo concreto: slides 4 e 5.
   O que resolveria: unificar a tese.

### Resposta do Orquestrador — rodada 2
R1.2 + R2.1 — ACEITAR: o Crítico está certo, saíram dois slides.

## Crítica — rodada 3

### Objeções
R3.1 [menor] (Público) — Sequência ambígua no slide 4.
   Motivo concreto: leitura dupla.
   O que resolveria: reordenar.

### Veredito
**APROVADA COM RESSALVAS**
- R3.1 (menor): reordenar o slide 4.
- Risco (b): resposta dos sócios pendente.

Proposta aprovada: v3.

### Nota do Orquestrador — resposta dos sócios (2026-10-07)
- Isto não é do debate e não deve virar balão.
"""


def _debate():
    return parse_debate(DEBATE_MD, piece="2026-10-07_automacao-para-clinicas")


def test_titulo_e_tentativas() -> None:
    d = _debate()
    assert d.title == "Automação para clínicas"
    assert d.kind == "peca"
    assert [a.number for a in d.attempts] == [1]
    assert [p.version for p in d.attempts[0].proposals] == [1, 2]


def test_tres_rodadas_com_objecoes_numeradas_e_gravidade() -> None:
    rounds = _debate().attempts[0].rounds
    assert [r.round for r in rounds] == [1, 2, 3]
    r1 = rounds[0]
    assert [o.id for o in r1.objections] == ["R1.1", "R1.2", "R1.3"]
    assert [o.gravity for o in r1.objections] == ["séria", "fatal", "menor"]
    primeira = r1.objections[0]
    assert primeira.criterion == "Gancho nos 3 primeiros segundos"
    assert primeira.text == "O slide 1 entrega a resposta inteira."
    assert primeira.reason == "o gancho põe a lista inteira no primeiro slide."
    assert primeira.fix == "um slide 1 com uma única tensão."


def test_objecao_em_varias_linhas_junta_o_texto() -> None:
    r1 = _debate().attempts[0].rounds[0]
    assert r1.objections[2].text == (
        "Texto demais no slide 4, continua na linha seguinte da objeção."
    )


def test_respostas_do_orquestrador_com_acao_e_ids() -> None:
    r1 = _debate().attempts[0].rounds[0]
    assert [(a.ids, a.action) for a in r1.answers] == [
        (["R1.1"], "ACEITAR"),
        (["R1.2"], "REBATER"),
        (["R1.3"], "ASSUMIR RISCO"),
    ]
    assert r1.answers[2].text == (
        "mantenho o texto e corro o risco de ficar denso; vale porque o slide é salvável."
    )


def test_resposta_combinada_cobre_dois_ids() -> None:
    r2 = _debate().attempts[0].rounds[1]
    assert r2.answers[0].ids == ["R1.2", "R2.1"]
    assert r2.answers[0].action == "ACEITAR"


def test_status_das_objecoes_anteriores() -> None:
    r2 = _debate().attempts[0].rounds[1]
    assert [(s.id, s.status) for s in r2.statuses] == [
        ("R1.1", "resolvida"),
        ("R1.2", "mantida"),
        ("R1.3", "risco aceito"),
    ]


def test_veredito_na_rodada_3_com_ressalvas() -> None:
    d = _debate()
    r3 = d.attempts[0].rounds[2]
    assert r3.answers == []  # na rodada 3 não há resposta
    assert d.attempts[0].verdict == "APROVADA COM RESSALVAS"
    assert d.verdict == "APROVADA COM RESSALVAS"
    assert d.attempts[0].verdict_notes == [
        "R3.1 (menor): reordenar o slide 4.",
        "Risco (b): resposta dos sócios pendente.",
    ]


def test_nota_do_orquestrador_fora_do_debate_nao_vira_balao() -> None:
    d = _debate()
    todos = [o.text for r in d.attempts[0].rounds for o in r.objections]
    todos += [a.text for r in d.attempts[0].rounds for a in r.answers]
    assert not any("não é do debate" in t for t in todos)
    assert not any("não deve virar balão" in n for n in d.attempts[0].verdict_notes)


def test_debate_em_andamento_nao_tem_veredito() -> None:
    md = DEBATE_MD.split("## Crítica — rodada 2")[0]
    d = parse_debate(md, piece="x")
    assert d.verdict is None
    assert d.state == "em debate"
    assert d.current_round == 1


def test_estado_reprovada() -> None:
    md = DEBATE_MD.replace("**APROVADA COM RESSALVAS**", "REPROVADA")
    d = parse_debate(md, piece="x")
    assert d.verdict == "REPROVADA"
    assert d.attempts[0].verdict == "REPROVADA"


def test_varias_tentativas_e_travado() -> None:
    md = "# Debate — Tema\n"
    for n in (1, 2, 3):
        md += (
            f"\n# Tentativa {n}\n\n## Proposta v1 — T\n\n"
            "## Crítica — rodada 3\n\n### Veredito\nREPROVADA\n"
        )
    d = parse_debate(md, piece="x")
    assert [a.number for a in d.attempts] == [1, 2, 3]
    assert d.state == "travado"


def test_sem_cabecalho_de_tentativa_conta_como_tentativa_1() -> None:
    md = (
        "# Debate — X\n\n## Proposta v1 — X\n\n## Crítica — rodada 1\n\n"
        "### Objeções\nR1.1 [menor] (Público) — algo.\n"
    )
    d = parse_debate(md, piece="x")
    assert d.attempts[0].number == 1
    assert d.attempts[0].rounds[0].objections[0].id == "R1.1"


def test_arquivo_vazio_ou_estranho_nao_quebra() -> None:
    assert parse_debate("", piece="x").attempts == []
    assert parse_debate("texto solto\nsem estrutura", piece="x").attempts == []


def test_cronograma_e_reconhecido_pela_pasta() -> None:
    d = parse_debate("# Debate — Cronograma\n", piece="cronograma-2026-10-08")
    assert d.kind == "cronograma"


# --- descoberta de arquivos e rota ---------------------------------------------------------


@pytest.fixture
def saida(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    pasta = tmp_path / "saida"
    pasta.mkdir()
    monkeypatch.setattr(debate_module, "saida_dir", lambda: pasta)
    return pasta


def _escreve(saida: Path, nome: str, texto: str, mtime: float | None = None) -> Path:
    pasta = saida / nome
    pasta.mkdir()
    arquivo = pasta / "debate.md"
    arquivo.write_text(texto, encoding="utf-8")
    if mtime is not None:
        os.utime(arquivo, (mtime, mtime))
    return arquivo


def test_find_debates_ordena_do_mais_recente_para_o_mais_antigo(saida: Path) -> None:
    agora = time.time()
    _escreve(saida, "2026-10-01_antigo", DEBATE_MD, agora - 1000)
    _escreve(saida, "2026-10-09_novo", DEBATE_MD, agora)
    (saida / "_amostras-voz").mkdir()  # pasta sem debate é ignorada
    assert [p for p, _ in find_debates()] == ["2026-10-09_novo", "2026-10-01_antigo"]


def test_rota_devolve_o_debate_mais_recente_e_a_lista(saida: Path) -> None:
    agora = time.time()
    _escreve(saida, "2026-10-01_antigo", DEBATE_MD, agora - 1000)
    _escreve(saida, "2026-10-09_novo", DEBATE_MD.replace("Automação para clínicas", "Outro"), agora)
    client = TestClient(app)
    body = client.get("/api/v1/brandforge/debate").json()
    assert body["debate"]["piece"] == "2026-10-09_novo"
    assert body["debate"]["title"] == "Outro"
    assert [a["piece"] for a in body["available"]] == ["2026-10-09_novo", "2026-10-01_antigo"]
    r1 = body["debate"]["attempts"][0]["rounds"][0]
    assert r1["objections"][0]["id"] == "R1.1"
    assert r1["answers"][0]["action"] == "ACEITAR"


def test_rota_com_peca_especifica(saida: Path) -> None:
    _escreve(saida, "2026-10-01_antigo", DEBATE_MD)
    client = TestClient(app)
    body = client.get("/api/v1/brandforge/debate?piece=2026-10-01_antigo").json()
    assert body["debate"]["piece"] == "2026-10-01_antigo"


def test_rota_recusa_caminho_fora_da_saida(saida: Path) -> None:
    client = TestClient(app)
    assert client.get("/api/v1/brandforge/debate?piece=../../etc").status_code == 422
    assert client.get("/api/v1/brandforge/debate?piece=nao-existe").status_code == 404


def test_rota_sem_debates_devolve_vazio(saida: Path) -> None:
    body = TestClient(app).get("/api/v1/brandforge/debate").json()
    assert body == {"debate": None, "available": []}
