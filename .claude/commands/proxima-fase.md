---
description: Executa a próxima fase pendente do plano de construção do escritório BrandForge
---

Leia docs/spec/plano-construcao.md do começo ao fim e siga a seção "Como executar uma fase".

Resumo do que fazer:
1. Na tabela "Estado", ache a primeira fase que não está concluída. Se a anterior estiver como "confirmar", verifique os commits e o "Pronto quando" dela antes de seguir.
2. Leia o "Contexto que não está nos prompts" e as fontes da verdade listadas no plano.
3. Execute só essa fase, com o Superpowers (executing-plans por padrão).
4. Ao terminar, atualize o "Estado", o "Diário de fases" e as "Pendências" no plano, faça commit (sem push) e me mostre um resumo curto: o que ficou pronto, o que depende de mim e o consumo medido com ccusage.

Não emende a fase seguinte nesta sessão.
