# Claude Code and Codex hooks

*[Leia isto em português](hooks.pt-BR.md)*

Hooks connect sessions to the My Office backend. Installing the project or opening the office does not register hooks automatically: configure the agent you use.

## Install with a command

`tools/install-hooks.sh` adds the hooks to the agent configuration for you, merging them with what is already there:

```bash
tools/install-hooks.sh --agent claude-code           # show what would change, write nothing
tools/install-hooks.sh --agent claude-code --apply   # apply the change
tools/install-hooks.sh --agent codex --apply
```

- Without `--apply`, it only prints the change as a diff.
- It changes only the My Office entries (commands ending in `tools/hook.sh` or `tools/codex-hook.sh`) and keeps every other hook and setting. Running it again changes nothing; after moving the clone, it replaces the old path.
- Before writing, it saves a copy next to the file (`settings.json.bak-<date>`). The file is rewritten with standard JSON formatting.
- It uses `CLAUDE_CONFIG_DIR` and `CODEX_HOME` when they are set.
- It downloads nothing and needs no administrator permissions. It checks for `jq` and `curl`, which the hooks need.
- To remove the hooks: `tools/install-hooks.sh --agent claude-code --uninstall --apply`.

Restart open sessions after installing. To configure by hand instead, follow the sections below.

## Before configuring

- Have `bash`, `jq`, and `curl` available, and keep the backend accessible at `http://127.0.0.1:5199`. For another address, set `MY_OFFICE_URL` in the agent's environment.
- Replace `/path/to/my-office` in the examples with the absolute path to your clone. The scripts must remain at that path and be executable.
- The examples show complete files for an empty configuration. If other settings or hooks already exist, **merge the entries** into the existing JSON and preserve them. Do not create a second `hooks` key in the same object or register the same command twice for the same event.
- Check the documentation and available events for your installed agent version. Back up the configuration before editing it.

The scripts select only the necessary fields, send the event in the background, and produce no output. They do not forward prompts, responses, or tool contents. The backend event API accepts requests only from the local machine.

## Claude Code

Add the entries below to `~/.claude/settings.json`. `tools/hook.sh` reads event JSON from standard input and sends the session ID, working directory, event name, PID, and, for `StopFailure`, only the error type. `rate_limit` and `billing_error` appear as quota; other types appear as errors.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/hook.sh",
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
            "command": "/path/to/my-office/tools/hook.sh",
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
            "command": "/path/to/my-office/tools/hook.sh",
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
            "command": "/path/to/my-office/tools/hook.sh",
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
            "command": "/path/to/my-office/tools/hook.sh",
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
            "command": "/path/to/my-office/tools/hook.sh",
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
            "command": "/path/to/my-office/tools/hook.sh",
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
            "command": "/path/to/my-office/tools/hook.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

The PID lets the backend detect that a session ended when its process disappears, including when there is no `SessionEnd`. A closed session leaves the room and stays in the list as away for 4 hours (`timers.leaveList`). `StopFailure` requires support in the installed version. See the [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) for scopes, events, and configuration rules.

## Codex

Add the entries below to `~/.codex/hooks.json`, or `$CODEX_HOME/hooks.json` when `CODEX_HOME` is set. `tools/codex-hook.sh` sends the session ID, working directory, event, and agent identifier; it does not send a shared PID, prompt, response, or tool data.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "Interrupt": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "PreModelRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ],
    "PostModelRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/my-office/tools/codex-hook.sh"
          }
        ]
      }
    ]
  }
}
```

Review and trust new or changed Codex hook definitions before use. In the CLI, use `/hooks`; in the app, use the available hook review interface. Event formats and availability depend on the version: see the [Codex hooks documentation](https://developers.openai.com/codex/hooks/).

`PreModelRequest` signals work, and `PostModelRequest` with a failed result signals an error. A subsequent attempt returns the session to working. When the failure message is one of the messages Codex uses for exhausted usage (usage limit, quota, credits, spend cap or spend limit), the script sends a quota event instead; the message itself is read locally and never sent. This relies on Codex's English messages and may need updating if they change. `Interrupt` marks the session as finished and `SessionEnd` removes it when received.

To identify some exits without `SessionEnd`, the backend queries loaded session identifiers from the local Codex App Server, by default at `ws://127.0.0.1:8767`; `MY_OFFICE_CODEX_WS` changes the address. It marks as closed only sessions previously confirmed on that server and missing in two consecutive queries. If the server is unavailable or a session was never confirmed there, this check cannot establish that it ended; inactivity rules still apply.

## Test without affecting the service

In one terminal, start a separate backend with its own port and state:

```sh
XDG_STATE_HOME=/tmp/my-office-teste MY_OFFICE_PORT=5296 node server/index.js
```

In another terminal, watch the event stream:

```sh
curl -N http://127.0.0.1:5296/api/stream
```

In a third terminal, from the repository root, send an example event through the desired hook:

```sh
printf '%s\n' '{"session_id":"example","cwd":"/tmp/example","hook_event_name":"UserPromptSubmit"}' | \
  MY_OFFICE_URL=http://127.0.0.1:5296 bash tools/codex-hook.sh
```

The isolated backend's stream should show the session as working. Sending is asynchronous; wait a moment. To test Claude Code, use `bash tools/hook.sh` instead of the Codex script. Real events arrive only after configuring the corresponding agent's hooks.
