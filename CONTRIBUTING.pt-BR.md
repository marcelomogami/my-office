# Como contribuir com o My Office

*[Read this in English](CONTRIBUTING.md)*

Obrigado pelo interesse. O My Office é um escritório pequeno, local e somente de visualização para sessões de agentes. Relatos de bugs, correções, traduções, documentação e arte são bem-vindos.

## Antes de começar

- Para algo além de uma correção pequena, abra uma issue antes, para a mudança ser discutida.
- Tenha o escopo em mente: o escritório só mostra as sessões. Ele não controla agentes, não lê conversas e não coordena trabalho.

## Regra de privacidade

Hooks e integrações enviam **somente metadados**: identificador da sessão, pasta de trabalho, nome do evento, identificador do processo e, quando necessário, o tipo de erro ou o nome do agente. Nunca enviam prompt, resposta, entrada ou saída de ferramentas, conteúdo de arquivos ou credenciais. Uma mudança que precise de mais do que isso deve ser discutida numa issue antes.

Também não inclua dados pessoais no repositório: nada de nomes reais, personagens custom ou configuração pessoal. Esses ficam na pasta de configuração local (`~/.config/my-office`), fora do repositório.

## Rodar localmente

Requisitos: Node.js (LTS atual), Python 3 com [Pillow](https://pypi.org/project/pillow/) para o dock do Kitty, e `bash`, `jq` e `curl` para os hooks.

```sh
npm install
npm run dev                 # escritório web e backend em http://127.0.0.1:5199
```

Abra `http://127.0.0.1:5199/?demo` para ver sessões de exemplo, sem hooks. `?demo&ciclo` faz os status girarem e `?demo&descanso` preenche os lugares de descanso. Se o serviço do My Office já estiver rodando na porta 5199, pare-o antes ou use `npx vite --port <outra>`.

O dock roda dentro de um terminal Kitty:

```sh
python3 tools/dock/office.py                          # ao vivo, a partir do backend
python3 tools/dock/office.py --png /tmp/dock.png      # um quadro, sem o Kitty
python3 tools/dock/office.py --baias                  # um personagem em cada baia
```

Para mandar sessões reais ao backend local, instale os hooks ([guia](documentation/hooks.pt-BR.md)).

## Testes

As mesmas verificações rodam no GitHub Actions a cada push e pull request:

```sh
npm test                                                    # backend, lógica da página e scripts dos hooks
python3 -m unittest discover -s tools/dock -p 'test_*.py'  # dock do Kitty
npm run build                                               # build da página
```

Acrescente ou atualize testes junto com a mudança. Testes que mexem em arquivos de configuração usam pastas temporárias, nunca as suas.

## Mudanças e pull requests

- Trabalhe numa branch com um assunto só, com o nome dele (por exemplo `feature/…`, `fix/…`, `docs/…`).
- Faça commits focados, com um assunto curto em inglês que diga o que mudou. Issues, pull requests e comentários de código também são em inglês.
- Abra o pull request contra a `main`, explique o que mudou e por quê, e cite a issue.
- Atualize a documentação **nas duas línguas**: inglês (`README.md`, `documentation/*.md`) e português (`README.pt-BR.md`, `documentation/*.pt-BR.md`). Os textos da interface ficam em [`src/locales.json`](src/locales.json).

## Arte

Os sprites são pixel art em 1x, mapeados pela célula inteira. Leia o [guia de assets](documentation/assets.pt-BR.md) e o [de personagens](documentation/characters.pt-BR.md) antes de mudar uma folha: eles explicam o tamanho das células, o alinhamento, os editores e como conferir o resultado nos dois escritórios.

## Licenças

Ao contribuir, você concorda que seu código fica sob a [GNU General Public License v3.0 ou posterior](LICENSE) e sua arte sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), como descrito em [`assets/LICENSE.md`](assets/LICENSE.md). Não envie logos ou arte que você não possa licenciar assim.
