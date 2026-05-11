# BGG CLI

This Bun-first TypeScript project manages your BoardGameGeek collection from the CLI.

## Sign-in and stored data

On first use, the CLI prompts for your BoardGameGeek username and password and saves them under your user config directory (for example `~/.config/bgg-cli/credentials.json` on macOS and Linux).

Session cookies for authenticated collection requests are cached next to that file as `collection-auth.json`. If BGG rejects those cookies, the CLI logs in again using your saved password.

If `XDG_CONFIG_HOME` is set, the CLI uses `$XDG_CONFIG_HOME/bgg-cli/` instead of `~/.config/bgg-cli/`.

## Prerequisites

- [Bun](https://bun.sh/) runtime installed

## Installation

Run the CLI directly from npm with Bun:

```sh
bunx @aabuhijleh/bgg-cli list
bunx @aabuhijleh/bgg-cli sync ./games.json
```

Or install it globally:

```sh
bun add -g @aabuhijleh/bgg-cli
bgg list
bgg sync ./games.json
```

## Collection CLI

For local development, run the interactive TUI:

```sh
bun run collection
```

The TUI can list owned games, delete one selected collection item, or sync owned games from `src/data/games.json`.

You can also run commands directly:

```sh
bgg list
bgg list --json
bgg delete
bgg delete --collid 145365092
bgg sync
bgg sync ./games.json

bun run collection list
bun run collection list --json
bun run collection delete
bun run collection delete --collid 145365092
bun run collection sync
bun run collection sync src/data/games.json
```

`collection delete` fetches your owned collection and shows a picker by default. Passing `--collid` deletes that collection row without prompting for a row, which is useful for scripts.

## Syncing Owned Games

`bgg sync` reads `src/data/games.json` by default when running from this repository. For installed usage, pass your own JSON file path, such as `bgg sync ./games.json`.

The file must be a JSON array of BGG game objects; every valid object id in the file is synced, including expansions.

The sync flow:

1. Reads BGG object ids from the games JSON file.
2. Fetches your current owned collection page.
3. Skips games that are already owned.
4. Adds missing games through `https://boardgamegeek.com/geekcollection.php`.

## Development

Use Bun for local development:

```sh
bun install
bun run install-hooks
bun test
bun run check
bun run typecheck
```

`bun run install-hooks` enables Lefthook git hooks (optional, for contributors working in this repo).

Publish with Bun when you are ready:

```sh
bun publish
```

`prepublishOnly` runs check, typecheck, and tests before publishing.

New collection CLI behavior should be added under `src/app/`, and shared collection logic should live in `src/lib/collection.ts`.

This project should always use Bun APIs instead of Node APIs. For file I/O, use `Bun.file()` for reading, existence checks, and deletes, and `Bun.write()` for writes or copies. Use `Bun.env` only for ambient process environment values (for example `HOME`, `XDG_CONFIG_HOME`), not for BGG account secrets.
