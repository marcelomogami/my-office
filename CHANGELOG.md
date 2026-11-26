# Changelog

Notable changes are grouped by published version. Complete release notes are also available in the [GitHub releases](https://github.com/marcelomogami/my-office/releases).

## Unreleased

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
