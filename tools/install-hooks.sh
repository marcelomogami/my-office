#!/usr/bin/env bash
# Instala ou remove os hooks do My Office na configuração de um agente.
#
#   tools/install-hooks.sh --agent claude-code              mostra o que mudaria
#   tools/install-hooks.sh --agent claude-code --apply      aplica, com backup
#   tools/install-hooks.sh --agent codex --apply
#   tools/install-hooks.sh --agent claude-code --uninstall --apply
#
# Sem --apply, nada é gravado. Pode rodar quantas vezes quiser: só as
# entradas do My Office (os comandos que terminam em tools/hook.sh ou
# tools/codex-hook.sh) são trocadas ou removidas, e os demais hooks e
# configurações ficam como estão. Antes de gravar, o arquivo é copiado para
# <arquivo>.bak-<data>. Nada é baixado e não precisa de permissão de
# administrador.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: tools/install-hooks.sh --agent <claude-code|codex> [--uninstall] [--apply]

Adds the My Office hooks to the agent configuration, or removes them with
--uninstall. Without --apply, only shows the change; with --apply, writes it
after saving a backup next to the file.

  claude-code  ${CLAUDE_CONFIG_DIR:-~/.claude}/settings.json
  codex        ${CODEX_HOME:-~/.codex}/hooks.json
EOF
}

agent='' apply=0 uninstall=0
while (($#)); do
  case "$1" in
    --agent) agent="${2:-}"; shift 2 || { usage >&2; exit 2; } ;;
    --agent=*) agent="${1#*=}"; shift ;;
    --apply) apply=1; shift ;;
    --uninstall) uninstall=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
case "$agent" in
  claude-code)
    file="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
    command="$root/tools/hook.sh"
    pattern='/tools/hook\.sh$'
    events='["SessionStart","UserPromptSubmit","PreToolUse","PostToolUse","PreCompact","Stop","StopFailure","SessionEnd"]'
    entry='{"type":"command","command":$command,"timeout":5}'
    ;;
  codex)
    file="${CODEX_HOME:-$HOME/.codex}/hooks.json"
    command="$root/tools/codex-hook.sh"
    pattern='/tools/codex-hook\.sh$'
    events='["SessionStart","UserPromptSubmit","PreToolUse","PostToolUse","PreCompact","Stop","Interrupt","SessionEnd","PreModelRequest","PostModelRequest"]'
    entry='{"type":"command","command":$command}'
    ;;
  *) echo "Choose an agent with --agent claude-code or --agent codex." >&2; usage >&2; exit 2 ;;
esac

# Os hooks precisam de jq e curl para funcionar; este script, de jq e diff.
missing=()
for tool in jq curl diff; do command -v "$tool" >/dev/null || missing+=("$tool"); done
if ((${#missing[@]})); then
  echo "Missing required tools: ${missing[*]}. Install them and run again." >&2
  exit 1
fi

if [[ -e "$file" ]]; then
  if ! jq empty "$file" 2>/dev/null; then
    echo "$file is not valid JSON; nothing was changed. Fix it, or add the hooks by hand (documentation/hooks.md)." >&2
    exit 1
  fi
  current=$(jq . "$file")
else
  current='{}'
fi

# Remove as entradas do My Office que não servem mais: todas, ao desinstalar;
# ao instalar, as de outro caminho (um clone antigo) ou de eventos fora da
# lista. Grupos e eventos que ficarem vazios saem também. Depois, ao instalar,
# acrescenta um grupo só nos eventos que ainda não têm o comando, para uma
# instalação já certa ficar como está.
updated=$(jq --arg command "$command" --arg pattern "$pattern" --argjson events "$events" \
  --argjson uninstall "$uninstall" "
  def mine: (.command? // \"\") | type == \"string\" and test(\$pattern);
  def keep(\$event): (mine | not) or (\$uninstall == 0 and .command == \$command and (\$events | index(\$event)) != null);
  if (.hooks | type) == \"object\" then
    .hooks |= (to_entries
      | map(.key as \$event | .value |= (if type == \"array\" then
          map(if (.hooks | type) == \"array\" then .hooks |= map(select(keep(\$event))) else . end)
          | map(select((.hooks | type) != \"array\" or (.hooks | length) > 0))
        else . end))
      | map(select((.value | type) != \"array\" or (.value | length) > 0))
      | from_entries)
    | if .hooks == {} then del(.hooks) else . end
  else . end
  | if \$uninstall == 1 then . else
      reduce \$events[] as \$event (.;
        if [.hooks[\$event][]?.hooks[]? | select(.command == \$command)] | length > 0 then .
        else .hooks[\$event] = ((.hooks[\$event] // []) + [{hooks: [$entry]}]) end)
    end
" <<<"$current")

if [[ "$updated" == "$current" ]]; then
  echo "$file is already up to date; nothing to do."
  exit 0
fi

action=$([[ $uninstall == 1 ]] && echo "remove the My Office hooks from" || echo "add the My Office hooks to")
echo "This will $action $file:"
echo
diff -u --label "$file (current)" --label "$file (new)" <(printf '%s\n' "$current") <(printf '%s\n' "$updated") || true
echo

if ((!apply)); then
  echo "Nothing was written. Run again with --apply to make this change."
  exit 0
fi

mkdir -p "$(dirname "$file")"
if [[ -e "$file" ]]; then
  backup="$file.bak-$(date +%Y%m%d-%H%M%S)"
  n=1
  while [[ -e "$backup" ]]; do backup="$file.bak-$(date +%Y%m%d-%H%M%S)-$((n++))"; done
  cp -p "$file" "$backup"
  echo "Backup saved to $backup"
fi
tmp=$(mktemp "$file.XXXXXX")
printf '%s\n' "$updated" >"$tmp"
[[ -e "$file" ]] && chmod --reference="$file" "$tmp" 2>/dev/null || true
mv "$tmp" "$file"
echo "Updated $file. Restart open $agent sessions to load the change."
