# Escritório 2 no Kitty

*[Read this in English](kitty.md)*

O escritório 2 é um cliente de visualização do my-office para o rodapé de uma janela do Kitty. Ele acompanha os mesmos eventos do escritório 1, mas tem layout e renderizador próprios. Não controla sessões nem acessa o conteúdo das conversas.

## Componentes

- O backend Node recebe eventos locais dos hooks e fornece a lista de sessões em `GET /api/stream`.
- `tools/dock/office.py` mantém uma conexão com esse stream, monta a sala e envia os quadros ao Kitty. Se a conexão cair, ele tenta novamente.
- `assets/pixel-office-2dpig/PixelOfficeAssetsNew3.png` é a folha em 1x. `tools/dock/frames.json` mapeia os recortes usados pelo dock; esse mapa é independente do mapa do escritório 1.
- `src/dock-preview/main.js` e `dock-preview.html` mostram uma prévia PixiJS do layout, útil para ajustar a disposição. A prévia não é o renderizador do terminal.

O escritório 1 e o dock podem receber o mesmo stream simultaneamente. Não é necessário manter a página do escritório 1 aberta. O backend e os hooks são compartilhados; o renderizador do dock não envia comandos aos agentes.

## Como o desenho chega ao Kitty

O programa Python usa Pillow para compor a imagem em memória a partir da folha e dos objetos da sala. A sala mede 478 × 72 pixels lógicos e é ampliada sem suavização para 956 × 144 pixels; com a margem e a lista, o quadro completo mede 1514 × 148 pixels. O programa codifica o quadro em PNG e o envia ao terminal pelo protocolo gráfico do Kitty.

O backend envia a lista atual na conexão e novamente quando há mudanças. O renderizador atualiza a imagem ao receber uma lista nova. Enquanto há uma sessão trabalhando, ele também atualiza os pontos do balão aproximadamente a cada 400 ms. Os tempos na lista são atualizados quando mudam de minuto; fora dessas situações, a imagem fica parada.

A captura do navegador usada no primeiro experimento foi apenas um teste estático. O renderizador atual não depende de navegador, PixiJS ou `kitten icat` para desenhar.

## Abrir o dock

É necessário ter Python 3, Pillow, o backend do my-office acessível e uma versão do Kitty com `os-window-dock` e suporte ao protocolo gráfico. A implementação foi testada no Kitty 0.51.0. Verifique a dependência Python com:

```sh
python3 -c 'import PIL; print(PIL.__version__)'
```

Dentro de uma ação do Kitty, use o caminho absoluto do renderizador, substituindo `/caminho/para/my-office` pelo diretório do projeto:

```text
launch --type=os-window-dock --title=my-office-dock --focus-existing=@title --dock-edge=bottom --dock-size=9 --dock-skip-focus --keep-focus /usr/bin/python3 /caminho/para/my-office/tools/dock/office.py
```

Essa é uma ação `launch` do Kitty, adequada a um `map` em `kitty.conf`, não um comando de shell isolado. O dock inferior pertence à janela do Kitty, aparece ao trocar de aba e fecha quando essa janela fecha. `--dock-skip-focus` impede que receba foco; `--keep-focus` mantém o foco no terminal atual. O título com `--focus-existing=@title` permite reaproveitar o dock já existente na janela. As mesmas opções de reaproveitamento podem ser usadas com `--type=tab` e `--tab-title` para evitar abas com título duplicado.

A altura `9` é medida em linhas do terminal, não em pixels. Ajuste conforme a fonte, bordas e tamanho da janela. Com abas laterais nativas, o dock ocupa a área de terminal à direita da barra, não a largura completa da janela. Em uma área mais estreita que a imagem, o Kitty pode cortar parte do desenho.

Não inclua uma ação de fechamento automático da aba atual se o atalho puder ser repetido em uma aba de trabalho. A configuração global e os atalhos pertencem ao usuário; o projeto não os altera automaticamente.

## Sessões e descanso

O backend determina os status e envia a skin e o lugar do escritório 1. O dock faz sua própria distribuição visual das seis baias para sessões. A dupla da direita dá prioridade a `~detran` (custom2) e `~secretario` (custom1); as demais posições ficam disponíveis para outras sessões. Boss aparece sempre na baia individual como boss. Sessões sem baia no backend ou com status `away` não são desenhadas na sala.

Quando uma sessão entra em `idle`, o dock escolhe aleatoriamente um dos seis lugares livres de descanso e mantém esse lugar até a sessão sair desse estado. No próximo descanso há novo sorteio. Os balões representam `working`, `done`, `error` e `quota`.

O prazo normal para entrar em descanso pertence ao backend, atualmente dez minutos. Para uma demonstração temporária somente no dock, adicione `--test-idle-seconds 10` ao comando do renderizador. A opção antecipa visualmente o descanso de sessões `done`, sem alterar o backend nem o escritório 1. Não a use no atalho normal.

A lista mostra até nove sessões, em três colunas de três cartões, com avatar, nome e status. O fundo ao redor da sala e dos cartões é transparente, permitindo ver o tema do Kitty. O tempo aparece abaixo do avatar para sessões com lugar na sala; quem está em home office não exibe esse tempo. O prazo de teste não altera os indicadores de status mantidos pelo backend.

## Testes

```sh
python3 -m unittest discover -s tools/dock -p 'test_*.py'
npm test
python3 tools/dock/office.py --png /tmp/my-office-dock.png
```

O último comando gera um quadro vazio para inspeção, sem conectar ao backend. Para testar um servidor isolado, inicie-o com `XDG_STATE_HOME=/tmp/my-office-teste MY_OFFICE_PORT=5296 node server/index.js` e passe `--url http://127.0.0.1:5296/api/stream` ao renderizador. O `npm run dev` usa a mesma porta 5199 do serviço padrão.
