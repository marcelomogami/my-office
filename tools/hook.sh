#!/usr/bin/env bash
# Hook do Claude Code para o my-office.
#
# Lê o JSON que o Claude Code manda na entrada, tira dele só o identificador
# da sessão, a pasta de trabalho e o nome do evento, junta o pid do processo
# do Claude Code (o pai deste script, para o backend saber quando a sessão
# morreu) e envia ao backend em segundo plano. Prompt, resposta e dados de
# ferramenta nunca saem daqui.
#
# Nunca atrapalha a sessão: não escreve nada na saída (que alguns eventos
# acrescentariam à conversa), não espera o envio e sempre termina com
# sucesso, com a sala aberta, fechada ou quebrada.
#
# MY_OFFICE_URL muda o endereço do backend (padrão http://127.0.0.1:5199).

url="${MY_OFFICE_URL:-http://127.0.0.1:5199}/api/evento"

# No StopFailure vai junto o tipo do erro (`rate_limit`, `server_error`...),
# uma palavra de uma lista fixa; a mensagem de erro em si fica de fora.
body=$(jq -c --arg pid "$PPID" '
  . as $in
  | {session_id, cwd, event: .hook_event_name}
  | select(all(.[]; type == "string"))
  | .pid = $pid
  | if $in.hook_event_name == "StopFailure" and ($in.error | type) == "string"
       and ($in.error | test("^[a-z_]{1,40}$"))
    then .error = $in.error else . end' 2>/dev/null) || exit 0
[ -n "$body" ] || exit 0

curl --silent --output /dev/null --max-time 2 --connect-timeout 1 \
  --header 'Content-Type: application/json' --data-binary "$body" "$url" \
  </dev/null >/dev/null 2>&1 &
disown 2>/dev/null
exit 0
