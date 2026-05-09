# opencode-launcher

TUI launcher for [OpenCode](https://github.com/sst/opencode) — project switcher and plugin manager.

## Features

- **Project list** — shows recent OpenCode projects sorted by last used, with session counts
- **Pin / Hide / Unhide** — organize your project list
- **Custom path** — open any directory directly
- **Change path** — reassociate sessions when a project moves
- **Plugin manager** — view plugin status, toggle auto-update, force rebuild, downgrade to specific commits
- **Auto-update OpenCode** — checks for new `opencode-ai` npm versions once per day
- **Centralized config** — stores config in `config/oc-config.json`, plugins in `config/plugins.json`
- **`<creator>/<repo>` layout** — plugin repos stored under `repos/<github-user>/<repo-name>` to prevent collisions

## Requirements

- [Bun](https://bun.sh/) runtime (uses `bun:sqlite` for reading the OpenCode session database)

## Installation

### As a managed plugin

Add the following to your `~/.config/opencode/config/plugins.json` array:

```json
{
  "name": "opencode-launcher",
  "url": "https://github.com/intisy/opencode-launcher.git",
  "install": null,
  "build": null,
  "bundle": null,
  "output": "oc-tui.js",
  "pluginFile": "oc-tui.js",
  "autoUpdate": true
}
```

### Manual installation

```bash
git clone https://github.com/intisy/opencode-launcher.git ~/.config/opencode/repos/intisy/opencode-launcher
```

### Shell alias

Add to your shell config (`.bashrc`, `.zshrc`, etc.):

```bash
oc() {
  local tmp=$(mktemp)
  OC_OUTPUT="$tmp" bun ~/.config/opencode/repos/intisy/opencode-launcher/oc-tui.js "$@"
  local dir=$(cat "$tmp" 2>/dev/null)
  rm -f "$tmp"
  if [ -n "$dir" ]; then
    cd "$dir" && opencode
  fi
}
```

## Usage

```bash
oc              # Launch TUI
oc 3            # Open project #3 directly
oc myproject    # Open first project matching "myproject"
```

### Keyboard shortcuts

#### Projects tab

| Key | Action |
|-----|--------|
| ↑↓ / W S | Navigate |
| Enter | Open action menu |
| O | Open project |
| P | Pin/Unpin |
| H | Hide |
| U | Unhide all |
| C | Custom path |
| ← → | Switch tabs |
| Q | Quit |

#### Plugins tab

| Key | Action |
|-----|--------|
| ↑↓ / W S | Navigate |
| Enter | Open action menu |
| F | Fetch remote updates |
| A | Toggle auto-update |
| U | Update plugin |
| Q | Quit |

## License

MIT
