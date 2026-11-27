# Changelog

Notable changes are grouped by published version. Complete release notes are also available in the [GitHub releases](https://github.com/marcelomogami/my-office/releases).

## [0.10.0](https://github.com/marcelomogami/my-office/releases/tag/v0.10.0)

- Makes the session lifecycle timers configurable in minutes under `timers` in the local `config.json`. Each timer counts from the previous step: `rest` from the last activity, `leaveRoom` from when the session started resting, `leaveList` from when it left the room or was closed, plus `homeOfficeLeaveList`. Each one is optional, and `config.example.json` lists the defaults (10, 230, 240 and 60). With them, a session still leaves the room 4 hours and the list 8 hours after its last activity; a closed session now stays listed as away for 4 hours instead of 8.
- Resting characters teleport to another free rest spot, never the same one, every 15 to 20 minutes while they keep resting (`timers.restMove`; `0` turns it off), in the web office and in the dock.
- Removes the unused `MY_OFFICE_IDLE_MIN` and `MY_OFFICE_AWAY_MIN` environment variables.

## [0.9.0](https://github.com/marcelomogami/my-office/releases/tag/v0.9.0)

- Translates the interface, with English as the default. Set `"language": "pt-BR"` in the local `config.json` for Brazilian Portuguese; the web office and the Kitty dock read the same translations from `src/locales.json`.
- Shows a large "disconnected" stamp over the room, in the web office and in the dock, when the connection to the backend has been lost for more than 10 seconds. The backend sends a named heartbeat, so a stalled connection is noticed without extra requests.
- Shows each session's agent as a colored dot between the face and the name in the session cards (orange for Claude Code, green for Codex), with the agent name in the web office tooltip.
- Adds `tools/install-hooks.sh` to install or remove the hooks for Claude Code and Codex. It shows the change first, writes only with `--apply` after a backup, and keeps every other hook and setting.
- Adds a contribution guide in English and Brazilian Portuguese, and issue templates for bug reports and feature requests.

## [0.8.0](https://github.com/marcelomogami/my-office/releases/tag/v0.8.0)

- Splits the artwork into three sprite sheets with JSON maps shared by the web office and the Kitty dock: characters, office objects, and interface (bubbles and icons). Sprites are mapped by full cell, and the wall and floor are drawn from sprites instead of code.
- Moves characters to their own sheet and catalog. Custom characters, office objects, and interface sprites can be layered over the defaults, by name, from the local configuration folder (`~/.config/my-office`), outside the repository.
- Reads fixed projects from a local `config.json`: each project can have its own character and desk. Fixed characters are left out of the random draw, and characters repeat only when the free ones run out.
- Numbers desks and rest spots from the Boss, right to left and top to bottom, the same way in both offices.
- Picks a random free rest spot for each resting session: seven in the web office and eight in the dock, with two characters on each sofa.
- Adjusts furniture, computers, rest spots, and bubbles to the new sheets in both offices, and adds rest and desk demonstrations (`?demo&descanso` on the web page, `--descanso` and `--baias` in the dock).
- Documents the assets: sheets, cell sizes, custom sheets, room layout, and how to edit and check sprites.

## [0.7.2](https://github.com/marcelomogami/my-office/releases/tag/v0.7.2)

- Closed sessions (Claude Code `SessionEnd` or ended process, Codex missing from the App Server) stay in the list as away for 8 hours instead of disappearing at once; a new session in the same project replaces them.
- Sessions with an error or quota bubble follow the same rules as finished sessions: they rest after 10 minutes without activity, leave the room after 4 hours and the list after 8 hours, instead of keeping the bubble at the desk for up to 4 hours.
- Codex sessions that run out of usage show the quota status instead of a generic error. The hook recognizes Codex's usage-limit messages locally and sends only the event name.
- Runs backend tests, dock tests and the web build on GitHub Actions for every push and pull request.

## [0.7.1](https://github.com/marcelomogami/my-office/releases/tag/v0.7.1)

- Licenses the code under GPL-3.0-or-later and the artwork created for the project under CC BY 4.0; the original 2dPig pack remains CC0.

## [0.7.0](https://github.com/marcelomogami/my-office/releases/tag/v0.7.0)

- Renames the manager character to Boss and adds the Boss as the first card in the Kitty list, without a status for now. Up to eight session cards follow.
- Adds bilingual English and Brazilian Portuguese READMEs and guides for Kitty and agent hooks.
- Adds a changelog and updates documentation for the current session lifecycle and Codex integration.

## [0.6.1](https://github.com/marcelomogami/my-office/releases/tag/v0.6.1)

- Dock list with up to nine sessions in three columns, including avatar, name, and status.
- Elapsed idle time below the avatar and home-office indication.
- Transparent background around the room and cards, matching the Kitty theme.

## [0.6.0](https://github.com/marcelomogami/my-office/releases/tag/v0.6.0)

- Compact office in a bottom Kitty dock, sharing the backend with the original web page.
- Python renderer using Pillow, reorganized sprite sheet, and layout preview.
- Six session workstations, one workstation for the Boss, and six rest positions; custom1 and custom2 have fixed positions.

## [0.5.0](https://github.com/marcelomogami/my-office/releases/tag/v0.5.0)

- Detects Codex session exits by querying the local App Server, after confirmed presence and two consecutive absences.
- App Server unavailability does not remove sessions; the hook identifies the agent without transmitting conversation contents.

## [0.4.2](https://github.com/marcelomogami/my-office/releases/tag/v0.4.2)

- Restores the third break-area position, moving the character away from the coffee machine.

## [0.4.1](https://github.com/marcelomogami/my-office/releases/tag/v0.4.1)

- Adjusts the height of the character seated on the sofa and reverses the direction of the cat and dog sprites.

## [0.4.0](https://github.com/marcelomogami/my-office/releases/tag/v0.4.0)

- Adds a sixth rest position on the sofa beside the cat and moves the dog.

## [0.3.0](https://github.com/marcelomogami/my-office/releases/tag/v0.3.0)

- Sessions without a workstation appear as home office, with avatar and status.
- They keep the finished indication without a rest timer and leave the list after one hour of inactivity.

## [0.2.3](https://github.com/marcelomogami/my-office/releases/tag/v0.2.3)

- Rest after ten minutes, leave the room after four hours, and leave the list after eight hours without activity.

## [0.2.2](https://github.com/marcelomogami/my-office/releases/tag/v0.2.2)

- Compact elapsed time since a session stopped in the sidebar.

## [0.2.1](https://github.com/marcelomogami/my-office/releases/tag/v0.2.1)

- Codex model failures appear as errors; a new attempt returns the session to working.
- Specific Codex quota detection remains pending.

## [0.2.0](https://github.com/marcelomogami/my-office/releases/tag/v0.2.0)

- Codex session integration through hooks, sending only metadata.
- Interruptions mark the session as finished.

## [0.1.0](https://github.com/marcelomogami/my-office/releases/tag/v0.1.0)

- First pixel-art room with real Claude Code sessions, six workstations, status bubbles, and a sidebar.
- Local backend, event hooks, session persistence, and a systemd user service.
