# Office 2 in Kitty

*[Leia isto em português](kitty.pt-BR.md)*

Office 2 is a My Office display for the bottom of a Kitty window. It uses the same session events as Office 1, with its own layout and renderer. It does not control sessions or access conversation contents.

## Components

- The Node backend receives local events from hooks and provides the session list at `GET /api/stream`.
- `tools/dock/office.py` keeps a connection to the stream, composes the room, and sends frames to Kitty. It retries if the connection drops.
- Furniture comes from `assets/office/` and bubbles and icons from `assets/ui/`, with the same maps used by Office 1 (`default.json`, one full cell per item); `tools/dock/sheets.py` loads them. Characters come from the same catalogs as Office 1, default and custom (see [Characters](characters.md)).

Office 1 and the dock can receive the same stream simultaneously. The Office 1 page does not need to remain open. They share the backend and hooks; the dock renderer does not send commands to agents.

## How drawing reaches Kitty

The Python program uses Pillow to compose the image in memory from the sprite sheet and room objects. The room is 478 × 72 logical pixels, enlarged without smoothing to 956 × 144 pixels. Including the margin and list, the full frame is 1514 × 148 pixels. The program encodes each frame as PNG and sends it using the Kitty graphics protocol.

The backend sends the current list on connection and again when it changes. The renderer updates the image on each new list. While a session is working, it also updates the bubble dots approximately every 400 ms. List timers update when their minute changes; otherwise, the image remains still.

The browser capture used in the first experiment was only a static test. The current renderer does not depend on a browser, PixiJS, or `kitten icat` to draw.

## Open the dock

You need Python 3, Pillow, an accessible My Office backend, and a Kitty version supporting `os-window-dock` and the graphics protocol. The implementation was tested with Kitty 0.51.0. Check the Python dependency with:

```sh
python3 -c 'import PIL; print(PIL.__version__)'
```

In a Kitty action, use the renderer's absolute path, replacing `/path/to/my-office` with the repository directory:

```text
launch --type=os-window-dock --title=my-office-dock --focus-existing=@title --dock-edge=bottom --dock-size=8 --dock-skip-focus --keep-focus /usr/bin/python3 /path/to/my-office/tools/dock/office.py
```

This is a Kitty `launch` action suitable for a `map` in `kitty.conf`, not a standalone shell command. The bottom dock belongs to the Kitty window, stays visible when switching tabs, and closes when that window closes. `--dock-skip-focus` prevents it from receiving focus; `--keep-focus` keeps focus in the current terminal. The title and `--focus-existing=@title` allow an existing dock in the window to be reused. The same reuse option can be used with `--type=tab` and `--tab-title` to avoid duplicate titled tabs.

The height `8` is measured in terminal rows, not pixels. The dock image is 148 pixels tall and is drawn from the top, so use the smallest number of rows that fits it: divide 148 by the height of one row and round up. With 20-pixel rows, `8` rows give 160 pixels, leaving 12 pixels below the image; `7` would crop it. Kitty also accepts a percentage of the window (for example `15%`), which allows finer adjustment but changes with the window size.

With Kitty's native sidebar tabs, the dock occupies the terminal area to their right, not the full window width. If the available area is narrower than the image, Kitty may crop part of the drawing.

Do not automatically close the active tab in a shortcut that may be repeated from a working tab. Global configuration and shortcuts belong to the user; the project does not change them automatically.

## Sessions and rest

The backend determines statuses and sends each session's character, desk and list face, including the [fixed projects](../README.md#fixed-projects). The dock uses the same desk numbers as the web page, from 1 next to the Boss to 6 at the left end. The Boss always appears at the individual workstation. Sessions without a backend workstation or with `away` status are not drawn in the room.

When a session becomes `idle`, the dock randomly selects one of the eight free rest positions (two standing and two chairs by the coffee table, and two on each sofa) and keeps it until the session leaves that state. The next rest gets a new selection. Bubbles represent `working`, `done`, `error`, and `quota`.

The normal delay before rest belongs to the backend and is currently ten minutes. For a temporary dock-only demonstration, add `--test-idle-seconds 10` to the renderer command. This visually advances the rest of `done` sessions without changing the backend or Office 1. Do not use it in the normal shortcut.

To check the rest positions, run `python3 tools/dock/office.py --descanso` in a Kitty tab: every spot gets a character, the list shows "lugar 1" to "lugar 8", and the image refreshes by itself when the dock code changes. `--descanso char3,char1` picks who takes the first spots.

In the same way, `--baias` puts a character in every desk, with mixed statuses, to check the bubbles.

The list shows the Boss first, without a status for now, followed by up to eight sessions in three columns of three cards. Session cards show avatar, name, and status. The background around the room and cards is transparent so the Kitty theme shows through. Elapsed time appears under the avatar for sessions with a room workstation; home-office sessions do not show it. The test delay does not change backend status indicators.

## Tests

```sh
python3 -m unittest discover -s tools/dock -p 'test_*.py'
npm test
python3 tools/dock/office.py --png /tmp/my-office-dock.png
```

The last command generates an empty frame for inspection without connecting to the backend. To test an isolated server, start it with `XDG_STATE_HOME=/tmp/my-office-teste MY_OFFICE_PORT=5296 node server/index.js` and pass `--url http://127.0.0.1:5296/api/stream` to the renderer. `npm run dev` uses the standard service's port 5199.
