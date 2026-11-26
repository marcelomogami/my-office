# My Office

[![Tests](https://github.com/marcelomogami/my-office/actions/workflows/tests.yml/badge.svg)](https://github.com/marcelomogami/my-office/actions/workflows/tests.yml)

*[Read this in English](README.md)*

**Um escritório em pixel art para acompanhar sessões do Claude Code e do Codex.** Cada sessão aparece como um personagem, com um balão que indica quando está trabalhando, terminou, encontrou um erro ou atingiu a cota.

![Prévia do escritório no Kitty, com a sala e a lista de sessões](assets/mockups/lista-sessoes-dock.png)

O projeto é uma visualização local: não controla os agentes nem lê o conteúdo das conversas. Os hooks enviam metadados a um backend em Node, que atualiza as interfaces. A imagem acima usa sessões de exemplo.

## Escolha seu escritório

| Interface | Como funciona |
|---|---|
| **Página web** | Sala em PixiJS com seis baias, áreas de descanso e lista de sessões. |
| **Dock do Kitty** | Sala compacta no rodapé do terminal, visível ao trocar de aba, com lista com o Boss e até oito sessões. |

As duas interfaces podem ficar abertas ao mesmo tempo e usam o mesmo backend. O Kitty é opcional para quem usa a página web.

## Começar

Você precisa de Node.js 20.19 ou superior na série 20, ou 22.12 ou superior, e npm. Para testar a página em modo de demonstração:

```sh
npm install
npm run dev
```

Abra **http://127.0.0.1:5199/?demo**. A demonstração usa sessões de exemplo; para mostrar sessões reais, configure os hooks do agente.

> O servidor de desenvolvimento usa a porta 5199. Se o serviço do my-office já estiver ativo nessa porta, pare `my-office.socket` e `my-office.service` antes de iniciar o desenvolvimento e volte a iniciar o socket ao terminar.

Para gerar a versão web de produção e iniciar o backend:

```sh
npm run build
npm start
```

O backend usa `127.0.0.1:5199` por padrão. O host e a porta podem ser alterados com `MY_OFFICE_HOST` e `MY_OFFICE_PORT`; a API de eventos aceita apenas conexões da própria máquina.

## Conectar os agentes

Os scripts [`tools/hook.sh`](tools/hook.sh) e [`tools/codex-hook.sh`](tools/codex-hook.sh) recebem os eventos do Claude Code e do Codex, respectivamente. Eles enviam somente metadados necessários à identificação da sessão e ao status, sem prompt, resposta ou conteúdo de ferramenta.

**[Como instalar, confiar e testar os hooks](documentation/hooks.pt-BR.md)**

A integração do Codex identifica falhas de modelo como erro e volta ao estado de trabalho em uma nova tentativa. A identificação específica de cota do Codex ainda não está disponível.

## Usar no Kitty

O dock precisa de Python 3, Pillow e uma versão do Kitty com `os-window-dock` e suporte ao protocolo gráfico. Foi testado no Kitty 0.51.0. O backend precisa estar ativo ou disponível por socket.

**[Como configurar e usar o dock do Kitty](documentation/kitty.pt-BR.md)**

## Como as sessões aparecem

Os balões mostram trabalho, conclusão, erro ou cota. Depois de **10 minutos** sem nova tarefa, uma sessão com baia vai descansar, tenha terminado, dado erro ou atingido a cota. Após **4 horas** sem atividade, sai da sala e libera a baia; após **8 horas**, sai também da lista. Sessões sem baia aparecem como home office e saem da lista após **1 hora** sem atividade.

Os nomes, personagens e algumas posições fixas refletem a configuração original do projeto. Para personalizá-los, consulte `server/names.js`, `src/sessions.js` e `tools/dock/office.py`.

## Desenvolvimento

Os testes rodam automaticamente no GitHub Actions a cada push e pull request ([`.github/workflows/tests.yml`](.github/workflows/tests.yml)). Para rodar localmente:

```sh
npm test                                             # testes do backend e da integração
python3 -m unittest discover -s tools/dock -p 'test_*.py'  # testes do dock
```

O backend expõe `POST /api/evento` para receber metadados locais e `GET /api/stream` para transmitir a lista de sessões. As sessões e os lugares lembrados ficam em `~/.local/state/my-office/`, ou no diretório definido por `XDG_STATE_HOME`.

As units em [`deploy/`](deploy/) mostram a configuração do serviço de usuário com ativação por socket. O caminho do projeto em `deploy/my-office.service` precisa ser ajustado se o repositório estiver em outro local. O histórico de versões está no [changelog](CHANGELOG.md).

## Licença

O código é licenciado sob a [GNU General Public License v3.0 ou posterior](LICENSE). A arte criada para o My Office é licenciada sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.pt-br); veja [`assets/LICENSE.md`](assets/LICENSE.md).

## Créditos

Os sprites são baseados no [Pixel Office Asset Pack, de 2dPig](https://2dpig.itch.io/pixel-office), distribuído sob [CC0](https://creativecommons.org/publicdomain/zero/1.0/). A folha inclui adaptações e desenhos adicionais feitos para o My Office.
