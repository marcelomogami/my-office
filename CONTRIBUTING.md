# Contributing to My Office

*[Leia isto em português](CONTRIBUTING.pt-BR.md)*

Thanks for your interest. My Office is a small, local, view-only office for agent sessions. Bug reports, fixes, translations, documentation and artwork are welcome.

## Before you start

- For anything beyond a small fix, open an issue first so the change can be discussed.
- Keep the scope in mind: the office only shows sessions. It does not control agents, read conversations or coordinate work.

## Privacy rule

Hooks and integrations send **only metadata**: session id, working directory, event name, process id and, where needed, an error type or agent name. They never send prompts, responses, tool inputs or outputs, file contents or credentials. A change that needs more than that must be discussed in an issue first.

Do not commit personal data either: no real names, custom characters or personal configuration. Those live in the local configuration folder (`~/.config/my-office`), outside the repository.

## Running locally

Requirements: Node.js (current LTS), Python 3 with [Pillow](https://pypi.org/project/pillow/) for the Kitty dock, and `bash`, `jq` and `curl` for the hooks.

```sh
npm install
npm run dev                 # web office and backend on http://127.0.0.1:5199
```

Open `http://127.0.0.1:5199/?demo` for example sessions without hooks. `?demo&ciclo` cycles the statuses and `?demo&descanso` fills the rest spots. If the My Office service is already running on port 5199, stop it first or run `npx vite --port <other>`.

The Kitty dock runs inside a Kitty terminal:

```sh
python3 tools/dock/office.py                          # live, from the backend
python3 tools/dock/office.py --png /tmp/dock.png      # one frame, without Kitty
python3 tools/dock/office.py --baias                  # a character in every desk
```

To send real sessions to your local backend, install the hooks ([guide](documentation/hooks.md)).

## Tests

The same checks run on GitHub Actions for every push and pull request:

```sh
npm test                                                    # backend, web logic and hook scripts
python3 -m unittest discover -s tools/dock -p 'test_*.py'  # Kitty dock
npm run build                                               # web office build
```

Add or update tests with your change. Tests that touch configuration files must use temporary folders, never your own.

## Changes and pull requests

- Work on a branch with one topic, named after it (for example `feature/…`, `fix/…`, `docs/…`).
- Keep commits focused, with a short subject in English that says what changed. Write issues, pull requests and code comments in English too.
- Open the pull request against `main`, explain what changed and why, and link the issue.
- Update the documentation in **both languages**: English (`README.md`, `documentation/*.md`) and Brazilian Portuguese (`README.pt-BR.md`, `documentation/*.pt-BR.md`). Interface texts live in [`src/locales.json`](src/locales.json).

## Artwork

Sprites are pixel art at 1x, mapped by full cell. Read the [assets guide](documentation/assets.md) and the [characters guide](documentation/characters.md) before changing a sheet: they cover cell sizes, alignment, editors and how to check the result in both offices.

## Licenses

By contributing, you agree that your code is licensed under the [GNU General Public License v3.0 or later](LICENSE) and your artwork under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), as described in [`assets/LICENSE.md`](assets/LICENSE.md). Do not submit logos or artwork you cannot license this way.
