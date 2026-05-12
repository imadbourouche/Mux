<p align="center">
  <img src="assets/logo.png" alt="Mux" width="640" />
</p>

# Mux

A local-only dashboard for running and managing development services. Each
service runs under a PTY, with its logs streamed over WebSocket to a React UI.
Configure args + env vars per service, switch between named profiles, send
input to the running process (e.g. sudo passwords or Quarkus `r`/`q`), open
the project in VSCode or Terminal, and detect listening ports automatically.

## Requirements

- macOS (uses `osascript` for the folder picker and Terminal.app, `open -a` for
  VSCode, `lsof` + `pgrep` for port detection)
- Go 1.22+ (developed against 1.26)
- Node 20+ and Yarn 1
- VSCode installed (optional — only needed for the **Open in VSCode** button)

## Build

```sh
make build
```

This bundles the React app to `web/dist`, then compiles a single Go binary
named `mux` that embeds the SPA via `go:embed`.

To run the production binary:

```sh
./mux
```

The server listens on `http://localhost:4000`. Override with `PORT=4001 ./mux`.

Check the version of any binary with `./mux --version`.

## Distributing as a single binary

`make release` cross-compiles a stripped, version-stamped binary for each
target platform into `dist/`:

```sh
make release VERSION=v1.0.0
```

Output:

```
dist/
├── mux-darwin-arm64        # Apple Silicon
└── mux-darwin-amd64        # Intel Macs
```

If `VERSION` is not provided, `make` falls back to `git describe`, or `dev`
if outside a git checkout. The value is embedded into the binary and shown
by `mux --version`.

### Installing the binary (end users)

Pick the binary matching your machine (Apple Silicon = `arm64`, Intel = `amd64`),
then:

```sh
chmod +x mux-darwin-arm64
mv mux-darwin-arm64 /usr/local/bin/mux
mux
```

Open `http://localhost:4000` in a browser.

The binary is self-contained: it embeds the React UI and uses
`~/.mux/data/` for state. Nothing is written next to the binary.

### macOS Gatekeeper

If you downloaded the binary (rather than built it locally), macOS will
quarantine it and refuse to run unsigned executables. Either right-click →
**Open** the first time, or remove the quarantine attribute:

```sh
xattr -d com.apple.quarantine /usr/local/bin/mux
```

For wider distribution, sign and notarize the binary with a Developer ID
certificate — left out of the v1 scope.

### Linux / Windows

The current build only ships macOS targets. Mux uses macOS-only tooling
for the folder picker (`osascript`), launching Terminal.app, and opening
VSCode via `open -a`. Linux/Windows ports would need replacements for those
handlers.

## Dev mode (with hot reload)

In two terminals:

```sh
make dev-server      # Go backend on :4000
make dev-web         # Vite frontend on :5173 (proxies /api to :4000)
```

Open `http://localhost:5173`.

## Data

All persistent state lives under `~/.mux/data/`:

- `services.json` — service definitions, profiles, args, env vars
- `shortcuts.json` — your customized keyboard shortcuts

Override the location with `MUX_HOME=/some/path ./mux`.

On first start, Mux automatically migrates a legacy `cwd/data/services.json`
into `~/.mux/data/services.json` if present.

## Features

- **Per-service config**: name, working directory, command, profile-scoped
  arguments and environment variables. Auto-save with a 500 ms debounce.
- **Named profiles**: each service has one or more profiles (e.g.
  `default`, `clone-db`). Switch at any time; only the active profile is
  applied at start.
- **Copy args / env from another service**: append (skipping duplicates) or
  replace.
- **PTY-based supervision**: spawn under a real PTY so tools that detect a TTY
  (Quarkus, ANSI colors, sudo prompts) work correctly. Process-group kill on
  stop (SIGTERM then SIGKILL after 5 s if still alive).
- **Live logs**: ANSI-colored, zoomable (font size 2–22), clearable per
  service. Input bar to send keystrokes (mask toggle for passwords).
- **Listening ports**: backend polls `lsof` every 3 s, displays detected
  ports as clickable `:port` chips that open in a new tab.
- **System notifications**: browser Notification on transition to `crashed`
  and on the first port becoming available after `running`.
- **Import / Export**: download `services.json` (with confirmation) or import
  another file in **merge** or **replace** mode.
- **Drag-reorder** services in the sidebar; **resize** the sidebar by its
  right edge; **collapse** to a thin strip with `☰`.
- **Quick-switch** services with a searchable palette.

## Default keyboard shortcuts

All shortcuts are editable from the **?** button in the sidebar or via
`⌥ /`. Changes are saved to `~/.mux/data/shortcuts.json`.

| Default | Action                       |
|---------|------------------------------|
| ⌥ P     | Quick-switch service         |
| ⌥ /     | Show keyboard shortcuts      |
| ⌥ S     | Start focused service        |
| ⌥ R     | Restart focused service      |
| ⌥ K     | Stop focused service         |
| Enter   | Send log input / pick service|
| Esc     | Close any open dialog        |

## Adding a service

Click **+ Add service** in the sidebar.

- **Import local project…** opens a native folder picker and pre-fills the
  service name and path.
- Or fill in **Name** and **Path** manually.

You can configure the command, arguments, and env vars after creation in the
detail pane.

## Notes

- HTTP is bound to all interfaces by default; the tool is intended for
  **local use only**. Do not expose port 4000 publicly — there is no auth and
  the API can start arbitrary processes.
- The shortcuts dialog uses physical key codes, so Option-modified keys on
  macOS (which produce special characters like `ß` for ⌥S) match by physical
  key.
