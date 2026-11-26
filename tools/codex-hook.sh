#!/usr/bin/env bash
# Hook do Codex: envia apenas identificador, pasta, evento e tipo de agente. Não transmite
# prompt, resposta, dados de ferramenta, nem PID de processo compartilhado.
# O envio ocorre em segundo plano e nunca interfere na sessão.
#
# Numa falha de modelo, o Codex manda só a mensagem do erro (`error`), sem código.
# As falhas que ele classifica como fim de cota têm mensagens fixas em inglês
# (codex-rs/protocol/src/error.rs: limite de uso, cota, créditos, teto de gasto);
# reconhecidas aqui, viram CodexQuotaExceeded. A mensagem nunca é enviada.

url="${MY_OFFICE_URL:-http://127.0.0.1:5199}/api/evento"
body=$(jq -c '
  . as $input
  | {session_id, cwd, event: (
      if $input.hook_event_name == "PreModelRequest" then "CodexModelStarted"
      elif $input.hook_event_name == "PostModelRequest" and $input.status == "failed" then
        (if (($input.error // "") | type == "string" and test("usage limit|quota exceeded|out of credits|spend cap|spend limit|rate limit exceeded|budget reached|upgrade to plus"; "i"))
         then "CodexQuotaExceeded" else "CodexModelFailed" end)
      else $input.hook_event_name end)}
  | .agent = "codex"
  | select(all(.[]; type == "string" and length > 0))
  | select(.event as $event | ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PreCompact", "Stop", "Interrupt", "SessionEnd", "CodexModelStarted", "CodexModelFailed", "CodexQuotaExceeded"] | index($event))
' 2>/dev/null) || exit 0
[ -n "$body" ] || exit 0

curl --silent --output /dev/null --max-time 2 --connect-timeout 1 \
  --header 'Content-Type: application/json' --data-binary "$body" "$url" \
  </dev/null >/dev/null 2>&1 &
disown 2>/dev/null
exit 0
