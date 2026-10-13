/**
 * Rótulos em português para os estados e fases dos agentes (usados no painel e no cartão).
 */

const LABELS_PT: Record<string, string> = {
  arriving: "chegando",
  reporting: "se apresentando",
  walking_to_desk: "indo para a mesa",
  working: "trabalhando",
  thinking: "pensando",
  waiting_permission: "esperando permissão",
  completed: "concluído",
  waiting: "aguardando",
  reporting_done: "entregando",
  leaving: "saindo",
  in_elevator: "no elevador",
  idle: "parado",
  phone_ringing: "telefone tocando",
  on_phone: "ao telefone",
  receiving: "recebendo",
  delegating: "delegando",
  reviewing: "revisando",
  completing: "concluindo",
  in_arrival_queue: "na fila de chegada",
  walking_to_ready: "indo ao ponto de conversa",
  conversing: "conversando",
  walking_to_boss: "indo ao chefe",
  at_boss: "com o chefe",
  departing: "saindo",
  in_departure_queue: "na fila de saída",
  walking_to_elevator: "indo ao elevador",
};

/** Estado ou fase legível; em pt-BR usa o texto traduzido, nos demais idiomas só tira os "_". */
export function formatStateLabel(value: string, language: string): string {
  if (language === "pt-BR" && LABELS_PT[value]) return LABELS_PT[value];
  return value.replace(/_/g, " ");
}
