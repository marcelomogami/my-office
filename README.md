# My Office

Protótipo local de um escritório em pixel art feito com PixiJS: réplica da cena de exemplo do pacote do 2dPig, sem o céu. A cena é estática e ainda não acompanha sessões de agentes.

## Como executar

É necessário ter Node.js e npm instalados.

```sh
npm install
npm run dev
```

Abra o endereço local informado no terminal. Para gerar a versão de produção, execute `npm run build`.

Os sprites são do [Pixel Office Asset Pack, de 2dPig](https://2dpig.itch.io/pixel-office), distribuído sob CC0.

A disposição fica em `src/scene.json` e o mapa dos sprites em `src/frames.json`. Tudo vem de `assets/pixel-office-2dpig/PixelOfficeAssetsNew2.png`, a folha do pacote com acréscimos desenhados à mão (personagens sentados, cadeiras de escritório, porta dupla e bandeira do Brasil). `python3 tools/compose_scene.py` gera um PNG da cena sem navegador, em `assets/mockups/office-layout-claude.png`.

## Sessões e balões

Cada sessão aberta vira um personagem numa baia. As sessões fixas (`~detran`, `~secretario`, `~secretario-dev` e, quando o Codex for ligado, `chat-ferramentas`) têm sempre a mesma skin, e `~detran` e `~secretario` também a mesma baia; as outras ganham uma skin livre sorteada, lembrada no navegador para não mudar a cada recarregamento, e aparecem com o nome do projeto. A configuração fica em `src/sessions.js`. Passando o mouse num personagem aparece o nome da sessão, e o quadro ao lado da sala lista todas com rosto, nome e status.

O balão mostra o status: trabalhando (pontinhos animados), pronto (joinha), erro (exclamação vermelha, pulando) ou cota acabou (bateria vazia). Os balões são sempre brancos. Quando a sessão fica muito tempo sem tarefa (`idle`), o personagem levanta e vai para a copa. Os status e o evento de origem de cada um ficam em `src/status.js`; o desenho do balão, em `src/bubbles.js`.

Enquanto as sessões reais não estão ligadas, a página mostra uma demonstração fixa. Com `?ciclo` na URL, os status giram. No console do navegador, `office.update('paracetacaro', 'working')` abre ou atualiza uma sessão e `office.close('my-office')` fecha uma.
