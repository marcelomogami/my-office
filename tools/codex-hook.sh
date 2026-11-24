#!/usr/bin/env bash
# Hook do Codex: envia apenas identificador, pasta e evento. Não transmite
# prompt, resposta, dados de ferramenta, nem PID de processo compartilhado.
# O envio ocorre em segundo plano e nunca interfere na sessão.

url="${MY_OFFICE_URL:-http://127.0.0.1:5199}/api/evento"
body=$(jq -c '
  {session_id, cwd, event: .hook_event_name}
  | select(all(.[]; type == "string" and length > 0))
  | select(.event as $event | ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PreCompact", "Stop", "Interrupt", "SessionEnd"] | index($event))
' 2>/dev/null) || exit 0
[ -n "$body" ] || exit 0

curl --silent --output /dev/null --max-time 2 --connect-timeout 1 \
  --header 'Content-Type: application/json' --data-binary "$body" "$url" \
  </dev/null >/dev/null 2>&1 &
disown 2>/dev/null
exit 0
