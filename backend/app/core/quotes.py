"""Falas do chefe para situações do escritório (em português)."""

import random

JOB_COMPLETION_QUOTES: list[str] = [
    # Conclusões clássicas
    "Tudo certo. Peça pronta!",
    "E está entregue! Ótimo trabalho, pessoal!",
    "Missão cumprida! Excelente!",
    "Finalizado! Hora de comemorar!",
    "Mais uma peça no ar!",
    "Concluído! Trabalho de primeira!",
    "Pronto e revisado! Muito bem, equipe!",
    "Entregue! Esforço excepcional!",
    "Era a última etapa! Brilhante!",
    "Tudo concluído! Podem se aplaudir!",
    # Chefe satisfeito
    "Eu mesmo não faria melhor!",
    "É exatamente o que eu queria!",
    "Superou as expectativas!",
    "Qualidade em todas as etapas!",
    "Estou impressionado. De verdade!",
    "Execução impecável, pessoal!",
    "É por isso que eu amo esta equipe!",
    "Entrega sem falhas! Muito bem!",
    "Perfeição! Bravo!",
    "Vocês se superaram!",
    # Comemoração
    "Joguem o confete! Conseguimos!",
    "Hora da dancinha da vitória! 🎉",
    "Sucesso! Toquem o sino!",
    "Mais uma para a conta!",
    "Trabalho digno de brinde! 🍾",
    "Merecem uma ovação de pé!",
    "Hora da festa! Missão cumprida!",
    "Toca aqui, todo mundo!",
    "Abram os petiscos! Terminamos!",
    "Pizza merecida! 🍕",
    # Satisfação profissional
    "Tudo dentro do combinado. Pode publicar!",
    "Marca, texto e áudio conferidos. Perfeito!",
    "Pronto para o ar! Belo trabalho!",
    "O cliente vai adorar!",
    "Dentro do prazo e do orçamento. Lendário!",
    "Nenhuma objeção em aberto! Incrível!",
    "Daqui para frente é só alegria!",
    "Pronto para publicar! Vamos ao ar!",
    "Legendas e CTA prontos! Publiquem!",
    "O Revisor aprovou! Excelente!",
    # Chefe descontraído
    "Mandou bem! Vocês arrasam!",
    "Isso foi diferente! Trabalho incrível!",
    "Beijo do chef! Absolutamente perfeito! 👨‍🍳",
    "Sem ressalvas! Ficou lindo!",
    "Pode mandar! Estamos no ouro!",
    "Fechou! Execução perfeita!",
    "É assim que se faz! Bum!",
    "Momento de largar o microfone! 🎤",
    "Status de lendário alcançado!",
    "Nível acima! Adoro ver isso!",
    # Elogios
    "Fantástico!",
    "Magnífico!",
    "Soberbo!",
    "Extraordinário!",
    "Espetacular!",
    "Fenomenal!",
    "Incrível!",
    "Imaculado!",
    "Esplêndido!",
    "Maravilhoso!",
    # Brincadeiras
    "Zona livre de erros alcançada! 🐛❌",
    "Tão limpo que brilha! ✨",
    "Pronto para encantar o público!",
    "O eu do futuro vai agradecer!",
    "Isso é o que eu chamo de obra-prima!",
    "Até o Revisor ficou impressionado!",
    "Os deuses do conteúdo estão satisfeitos!",
    "Aprovado pelo patinho de borracha! 🦆",
    "Dez de dez! Publicaria de novo!",
]


def get_random_job_completion_quote() -> str:
    """Devolve uma fala aleatória de conclusão do trabalho."""
    return random.choice(JOB_COMPLETION_QUOTES)
