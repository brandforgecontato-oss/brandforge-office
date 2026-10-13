/**
 * Falas dos agentes para situações do escritório (em português).
 */

// Falas curtas ao aceitar um trabalho do chefe
export const WORK_ACCEPTANCE_QUOTES: string[] = [
  // Animado
  "Já estou nisso!",
  "Vamos lá!",
  "Entendido!",
  "Considere feito!",
  "Agora mesmo!",
  "Pode deixar comigo!",
  "Nem precisa falar mais!",
  "Pode contar!",
  "Com certeza!",
  "Claro!",
  // Profissional
  "Entendido.",
  "Será feito.",
  "Anotado.",
  "Recebido.",
  "Afirmativo.",
  "Copiado.",
  "Positivo.",
  "Perfeito.",
  "Certamente.",
  "Naturalmente.",
  // Descontraído
  "Fácil!",
  "Sem problema!",
  "Mamão com açúcar!",
  "Moleza!",
  "Eu dou conta!",
  "Olha só!",
  "Lá vou eu!",
  "Hora de brilhar!",
  "Minha especialidade!",
  "Nasci pra isso!",
  // Motivado
  "Desafio aceito!",
  "Pode vir!",
  "Bora fazer!",
  "Valendo!",
  "Pronto para o jogo!",
  "Carregado e pronto!",
  "Missão aceita!",
  "A todo vapor!",
  "À disposição!",
  "Já vou para a mesa!",
  // Divertido
  "Ooh, que legal!",
  "Até que enfim!",
  "Sim! Adorei!",
  "Minha hora de brilhar!",
  "Perfeito!",
  "Excelente!",
  "Fantástico!",
  "Brilhante!",
  "Esplêndido!",
  "Maravilha!",
  // Determinado
  "Não vou te decepcionar!",
  "Confia em mim.",
  "Estou contigo!",
  "Pode contar comigo!",
  "Essa é a minha praia!",
  "Bem a minha cara!",
  "Fui feito pra isso!",
  "É isso que eu faço!",
  "Observe e aprenda!",
  "Afasta que lá vem!",
  // Tecnológico
  "Organizando as ideias...",
  "Processando...",
  "Executando!",
  "Iniciando!",
  "Carregando a solução...",
  "Calculando!",
  "Analisando...",
  "Otimizando!",
  "Publicando!",
  "Sincronizando!",
  // Curtinho
  "Sim!",
  "Feito!",
  "Certo!",
  "Ok!",
  "Fechado!",
  "Aham!",
  "Bora!",
  "Tá!",
  "Pode crer!",
  "Beleza!",
  // Humor de escritório
  "Primeiro o café!",
  "Depois do lanche!",
  "Hora extra, então!",
  "Zona livre de reuniões!",
  "Caixa de entrada zerada depois!",
  "Prazo? Que prazo?",
  "Segura meu café!",
  "Produtividade no pico!",
  "Estado de fluxo chegando!",
  "Modo foco: LIGADO",
  // Confiante
  "Fácil demais!",
  "Brincadeira de criança!",
  "Simples!",
  "Trivial!",
  "Trabalho rápido!",
  "Velocidade da luz!",
  "Num piscar de olhos!",
  "Olha isso!",
  "Mandei bem!",
  "Arrasei!",
];

/**
 * Uma fala aleatória de aceite de trabalho.
 */
export function getRandomWorkAcceptanceQuote(): string {
  return WORK_ACCEPTANCE_QUOTES[
    Math.floor(Math.random() * WORK_ACCEPTANCE_QUOTES.length)
  ];
}

// Falas curtas ao entregar o trabalho pronto ao chefe
export const WORK_COMPLETION_QUOTES: string[] = [
  // Apresentando o trabalho
  "Aqui está a entrega!",
  "Saiu do forno!",
  "Quentinho do teclado!",
  "Assinado, selado, entregue!",
  "Entrega especial!",
  "Como pedido!",
  "Seu pedido está pronto!",
  "Embrulhado para presente!",
  "Direto da minha mesa!",
  "Feito com carinho!",
  // Orgulhoso
  "Meu melhor trabalho!",
  "Estou bem orgulhoso disto!",
  "Dá uma olhada!",
  "Contemple!",
  "Tcharam!",
  "Voilà!",
  "Apresentando...!",
  "A obra-prima!",
  "Meu magnum opus!",
  "Desempenho máximo!",
  // Conclusão confiante
  "Mandei bem!",
  "Arrasei!",
  "Feito e refeito!",
  "Missão cumprida!",
  "Tarefa concluída!",
  "Tudo pronto!",
  "Finalizado!",
  "Amarrado!",
  "Trancado!",
  "Na mão!",
  // Passagem descontraída
  "Toma!",
  "É todo seu!",
  "Pega!",
  "Pode levar!",
  "Sua vez!",
  "Agora é contigo!",
  "Pronto para revisão!",
  "Para a sua aprovação!",
  "Pode usar!",
  "Está tudo aí!",
  // Profissional
  "Conforme solicitado.",
  "Como combinado.",
  "Concluído conforme especificado.",
  "Pronto para aprovação.",
  "Aguardando retorno.",
  "Para a sua consideração.",
  "Favor revisar.",
  "Enviado.",
  "Entregue.",
  "Finalizado.",
  // Animado
  "Foi divertido!",
  "Gostei dessa!",
  "Que jornada!",
  "Aprendi muito!",
  "Ótimo desafio!",
  "Adorei!",
  "Quero mais!",
  "Que satisfação!",
  "Tudo tranquilo!",
  "Mamão com açúcar!",
  // Tecnológico
  "Sem erros, espero!",
  "Tudo conferido!",
  "Compilado com sucesso!",
  "Zero erros!",
  "Pode publicar!",
  "Pronto para o ar!",
  "Pronto para unir!",
  "Revisado e testado!",
  "Passou pela revisão!",
  "Fontes incluídas!",
  // Brincalhão
  "Não gaste tudo de uma vez!",
  "Manuseie com cuidado!",
  "Frágil: gênio lá dentro!",
  "Sem devolução!",
  "Pilhas incluídas!",
  "Requer alguma montagem!",
  "Aviso: incrível!",
  "Cuidado: quentão!",
  "Mente = explodida!",
  "De nada!",
  // Alívio
  "Finalmente!",
  "Ufa!",
  "Foi intenso!",
  "Saiu do meu prato!",
  "Peso tirado!",
  "Liberdade, enfim!",
  "Uma a menos!",
  "Caixa de entrada -1!",
  "Riscado da lista!",
  "Conferido!",
  // Curtinho
  "Pronto!",
  "Terminei!",
  "Completo!",
  "Aqui!",
  "Bum!",
  "Pá!",
  "Sim!",
  "Resolvido!",
  "Corrigido!",
  "Feito!",
];

/**
 * Uma fala aleatória de entrega de trabalho.
 */
export function getRandomWorkCompletionQuote(): string {
  return WORK_COMPLETION_QUOTES[
    Math.floor(Math.random() * WORK_COMPLETION_QUOTES.length)
  ];
}
