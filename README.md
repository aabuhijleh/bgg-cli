# BGG CLI

Manage your BoardGameGeek collection from the command line.

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

## Sign-in and stored data

On first use, the CLI prompts for your BoardGameGeek username and password and saves them under your user config directory (for example `~/.config/bgg-cli/credentials.json` on macOS and Linux).

Session cookies for authenticated collection requests are cached next to that file as `collection-auth.json`. If BGG rejects those cookies, the CLI logs in again using your saved password.

If `XDG_CONFIG_HOME` is set, the CLI uses `$XDG_CONFIG_HOME/bgg-cli/` instead of `~/.config/bgg-cli/`.

## Usage

```sh
bgg list
bgg list --json
bgg delete
bgg delete --collid 145365092
bgg sync ./games.json
```

`bgg delete` fetches your owned collection and shows a picker by default. Passing `--collid` deletes that collection row without prompting, which is useful for scripts.

## Syncing Owned Games

`bgg sync` takes a path to a JSON file containing an array of BGG game objects. Every valid object id in the file is synced, including expansions.

The sync flow:

1. Reads BGG object ids from the JSON file.
2. Fetches your current owned collection.
3. Skips games that are already owned.
4. Adds missing games to your collection.
