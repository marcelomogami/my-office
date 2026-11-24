# My Office

Escritório em pixel art, feito com PixiJS, que mostra cada sessão de agente de IA aberta como um personagem numa baia, com o status num balão. É só para ver: não controla as sessões nem lê o que elas fazem. Um backend local em Node, sem dependências, recebe eventos das sessões e repassa à página.

## Como executar

É necessário ter Node.js e npm instalados.

```sh
npm install
npm run dev      # desenvolvimento: página e backend em http://127.0.0.1:5199
npm test         # testes do backend
npm run build    # gera dist/
npm start        # backend servindo dist/ (MY_OFFICE_HOST, MY_OFFICE_PORT)
```

As sessões chegam por `POST /api/evento` com `{ "session_id", "cwd", "event" }`, só da própria máquina, e a página as recebe por `GET /api/stream`. Exemplo:

```sh
curl -X POST 127.0.0.1:5199/api/evento -d '{"session_id":"1","cwd":"'$PWD'","event":"UserPromptSubmit"}'
```

As sessões do Claude Code chegam pelo `tools/hook.sh` (precisa de `jq` e `curl`), ligado aos eventos `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `Stop` e `SessionEnd`; ele manda só o identificador da sessão, a pasta, o nome do evento e o pid do processo do Claude Code (para o backend tirar da sala as sessões que morreram). Para deixar a sala sempre disponível, as units em `deploy/` rodam o backend como serviço do systemd do usuário, ativado por socket na porta 5199 e encerrado sozinho depois de 10 minutos sem uso:

```sh
npm run build
ln -s "$PWD"/deploy/my-office.{socket,service} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now my-office.socket
```

O caminho do projeto está fixo em `deploy/my-office.service` (`~/projects/personal/my-office`). Para usar o `npm run dev`, pare antes `my-office.socket` e `my-office.service`, que usam a mesma porta.

Skins e lugares sorteados ficam em `~/.local/state/my-office/memory.json`, e as sessões abertas, em `sessions.json`, para voltarem quando o backend reinicia.

Os sprites são do [Pixel Office Asset Pack, de 2dPig](https://2dpig.itch.io/pixel-office), distribuído sob CC0.

A disposição fica em `src/scene.json` e o mapa dos sprites em `src/frames.json`. Tudo vem de `assets/pixel-office-2dpig/PixelOfficeAssetsNew2.png`, a folha do pacote com acréscimos desenhados à mão (personagens sentados, cadeiras de escritório, porta dupla e bandeira do Brasil). `python3 tools/compose_scene.py` gera um PNG da cena sem navegador, em `assets/mockups/office-layout-claude.png`.

## Sessões e balões

Cada sessão aberta vira um personagem numa baia. As sessões fixas (`~detran`, `~secretario`, `~secretario-dev` e, quando o Codex for ligado, `chat-ferramentas`) têm sempre a mesma skin, e `~detran` e `~secretario` também a mesma baia; as outras ganham uma skin livre sorteada, lembrada para não mudar a cada reinício, e aparecem com o nome do projeto. A configuração fica em `src/sessions.js`. Passando o mouse num personagem aparece o nome da sessão, e o quadro ao lado da sala lista todas com rosto, nome e status.

O balão mostra o status: trabalhando (pontinhos animados), pronto (joinha), erro (exclamação vermelha, pulando) ou cota acabou (bateria vazia). Os balões são sempre brancos. Quando a sessão fica 30 minutos pronta sem nova tarefa (`idle`), o personagem levanta e vai para a copa (até 3) ou para a mesa de reunião (mais 2). Depois de 4 horas sem atividade, vai embora: sai da sala, libera a baia e fica só no quadro lateral até a sessão voltar a agir. Os status e o evento de origem de cada um ficam em `src/status.js`; o desenho do balão, em `src/bubbles.js`.

Com `?demo` na URL, a página mostra uma demonstração fixa, sem backend; com `?demo&ciclo`, os status giram. No console do navegador, `office.update('paracetacaro', 'working')` abre ou atualiza uma sessão e `office.close('my-office')` fecha uma.
