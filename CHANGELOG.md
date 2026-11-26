# Changelog

As mudanças estão organizadas por versão publicada. As notas completas de cada versão também estão nas [releases do GitHub](https://github.com/marcelomogami/my-office/releases).

## [0.6.1](https://github.com/marcelomogami/my-office/releases/tag/v0.6.1)

- Lista no dock com até nove sessões em três colunas, avatar, nome e status.
- Tempo parado abaixo do avatar e indicação de home office.
- Fundo transparente ao redor da sala e dos cartões, integrado ao tema do Kitty.

## [0.6.0](https://github.com/marcelomogami/my-office/releases/tag/v0.6.0)

- Escritório compacto em dock inferior do Kitty, compartilhando o backend com a página original.
- Renderizador Python com Pillow, folha de sprites reorganizada e prévia do layout.
- Seis baias para sessões, uma baia para Boss e seis lugares de descanso; custom1 e custom2 têm posições fixas.

## [0.5.0](https://github.com/marcelomogami/my-office/releases/tag/v0.5.0)

- Detecção da saída de sessões do Codex pela consulta ao App Server local, com confirmação de presença e duas ausências consecutivas.
- Indisponibilidade do App Server não remove sessões; o hook identifica a origem sem transmitir conteúdo.

## [0.4.2](https://github.com/marcelomogami/my-office/releases/tag/v0.4.2)

- Restaura a terceira posição de descanso da copa, afastando o personagem da cafeteira.

## [0.4.1](https://github.com/marcelomogami/my-office/releases/tag/v0.4.1)

- Ajusta a altura do personagem no sofá e inverte a direção dos sprites do gato e do cachorro.

## [0.4.0](https://github.com/marcelomogami/my-office/releases/tag/v0.4.0)

- Acrescenta o sexto lugar de descanso no sofá, junto ao gato, e muda o cachorro de lugar.

## [0.3.0](https://github.com/marcelomogami/my-office/releases/tag/v0.3.0)

- Sessões sem baia aparecem como home office, com rosto e status.
- Mantêm a indicação de pronto sem contador de descanso e saem da lista após uma hora de inatividade.

## [0.2.3](https://github.com/marcelomogami/my-office/releases/tag/v0.2.3)

- Descanso após dez minutos; saída da sala após quatro horas e remoção da lista após oito horas sem atividade.

## [0.2.2](https://github.com/marcelomogami/my-office/releases/tag/v0.2.2)

- Tempo desde a parada na lista lateral, em formato compacto.

## [0.2.1](https://github.com/marcelomogami/my-office/releases/tag/v0.2.1)

- Falhas de modelo do Codex aparecem como erro; uma nova tentativa retoma o estado trabalhando.
- Identificação específica de cota do Codex permanece pendente.

## [0.2.0](https://github.com/marcelomogami/my-office/releases/tag/v0.2.0)

- Integração das sessões do Codex por hooks, enviando apenas metadados.
- Interrupções passam a mostrar a sessão como pronta.

## [0.1.0](https://github.com/marcelomogami/my-office/releases/tag/v0.1.0)

- Primeira sala em pixel art com sessões reais do Claude Code, seis baias, balões de status e quadro lateral.
- Backend local, hooks de eventos, persistência de sessões e serviço do systemd do usuário.
