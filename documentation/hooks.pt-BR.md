# Hooks do Claude Code e do Codex

*[Read this in English](hooks.md)*

Os hooks conectam as sessões ao backend do My Office. Instalar o projeto ou abrir o escritório não registra hooks automaticamente: é preciso configurar o agente que você usa.

## Instalar com um comando

`tools/install-hooks.sh` acrescenta os hooks à configuração do agente por você, integrando-os ao que já existe:

```bash
tools/install-hooks.sh --agent claude-code           # mostra o que mudaria, sem gravar nada
tools/install-hooks.sh --agent claude-code --apply   # aplica a mudança
tools/install-hooks.sh --agent codex --apply
```

- Sem `--apply`, só mostra a mudança, como um diff.
- Mexe só nas entradas do My Office (comandos que terminam em `tools/hook.sh` ou `tools/codex-hook.sh`) e preserva todos os outros hooks e configurações. Rodar de novo não muda nada; depois de mudar o clone de lugar, troca o caminho antigo.
- Antes de gravar, guarda uma cópia ao lado do arquivo (`settings.json.bak-<data>`). O arquivo é regravado com a formatação padrão de JSON.
- Usa `CLAUDE_CONFIG_DIR` e `CODEX_HOME` quando estão definidos.
- Não baixa nada e não pede permissão de administrador. Confere se há `jq` e `curl`, que os hooks usam.
- Para remover os hooks: `tools/install-hooks.sh --agent claude-code --uninstall --apply`.

Reinicie as sessões abertas depois de instalar. Para configurar à mão, siga as seções abaixo.

## Antes de configurar

- Tenha `bash`, `jq` e `curl` disponíveis, e mantenha o backend acessível em `http://127.0.0.1:5199`. Para outro endereço, defina `MY_OFFICE_URL` no ambiente do agente.
- Substitua `/caminho/para/my-office` nos exemplos pelo caminho absoluto do clone. Os scripts devem permanecer nesse caminho e ter permissão de execução.
- Os exemplos mostram arquivos completos para uma configuração vazia. Se já houver configurações ou outros hooks, **integre as entradas** ao JSON existente, preservando-as. Não crie uma segunda chave `hooks` no mesmo objeto nem registre o mesmo comando duas vezes para o mesmo evento.
- Confira a documentação e os eventos disponíveis na versão instalada do agente. Faça uma cópia da configuração antes de editá-la.

Os scripts selecionam apenas os campos necessários, enviam o evento em segundo plano e não produzem saída. Não encaminham prompt, resposta ou conteúdo de ferramentas. A API de eventos do backend aceita apenas requisições da própria máquina.

## Claude Code

Adicione as entradas abaixo a `~/.claude/settings.json`. O script `tools/hook.sh` recebe o JSON do evento pela entrada padrão e envia identificador da sessão, diretório, nome do evento, PID e, em `StopFailure`, somente o tipo de erro. Os tipos `rate_limit` e `billing_error` aparecem como cota; outros tipos aparecem como erro.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "StopFailure": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/hook.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

O PID permite que o backend perceba que a sessão terminou quando seu processo deixa de existir, inclusive se não houver `SessionEnd`. A sessão fechada sai da sala e continua na lista como "foi embora" por 4 horas (`timers.leaveList`). O `StopFailure` depende de suporte na versão instalada. Consulte a [referência de hooks do Claude Code](https://code.claude.com/docs/en/hooks) para escopos, eventos e regras de configuração.

## Codex

Adicione as entradas abaixo a `~/.codex/hooks.json`, ou a `$CODEX_HOME/hooks.json` se `CODEX_HOME` estiver definido. O script `tools/codex-hook.sh` envia identificador da sessão, diretório, evento e identificação do agente; não envia PID compartilhado, prompt, resposta nem dados de ferramenta.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "Interrupt": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "PreModelRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "PostModelRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/caminho/para/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ]
  }
}
```

No Codex, revise e confie nas definições novas ou alteradas antes do uso. Na CLI, use `/hooks`; no aplicativo, consulte a revisão de hooks disponível na interface. O formato e a disponibilidade dos eventos dependem da versão: veja a [documentação de hooks do Codex](https://developers.openai.com/codex/hooks/).

`PreModelRequest` indica trabalho e `PostModelRequest` com resultado de falha indica erro. Uma tentativa posterior volta ao estado trabalhando. Quando a mensagem da falha é uma das que o Codex usa para uso esgotado (limite de uso, cota, créditos, teto ou limite de gasto), o script envia um evento de cota; a mensagem é lida localmente e nunca é enviada. Isso depende das mensagens em inglês do Codex e pode precisar de ajuste se elas mudarem. `Interrupt` indica pronto e `SessionEnd` remove a sessão quando esse evento é recebido.

Para identificar algumas saídas sem `SessionEnd`, o backend consulta os identificadores de sessões carregadas no Codex App Server local, por padrão em `ws://127.0.0.1:8767`; `MY_OFFICE_CODEX_WS` altera o endereço. Ele marca como encerradas somente sessões que já foram confirmadas naquele servidor e estão ausentes em duas consultas. Se o servidor estiver indisponível ou a sessão nunca tiver sido confirmada nele, essa verificação não prova que ela terminou; continuam valendo as regras de inatividade.

## Testar sem interferir no serviço

Em um terminal, inicie um backend separado, com estado e porta próprios:

```sh
XDG_STATE_HOME=/tmp/my-office-teste MY_OFFICE_PORT=5296 node server/index.js
```

Em outro terminal, acompanhe os eventos:

```sh
curl -N http://127.0.0.1:5296/api/stream
```

Em um terceiro terminal, a partir da raiz do projeto, envie um evento de exemplo pelo hook desejado:

```sh
printf '%s\n' '{"session_id":"exemplo","cwd":"/tmp/exemplo","hook_event_name":"UserPromptSubmit"}' | \
  MY_OFFICE_URL=http://127.0.0.1:5296 bash tools/codex-hook.sh
```

A lista transmitida pelo backend isolado deve mostrar a sessão trabalhando. O envio é assíncrono; aguarde um instante. Para testar o Claude Code, use `bash tools/hook.sh` no lugar do script do Codex. Eventos reais só chegarão após a configuração dos hooks no respectivo agente.
