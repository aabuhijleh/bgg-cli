# BGG Collection CLI

This Bun-first TypeScript project manages your BoardGameGeek owned collection from the `src/app/collection.ts` CLI.

## Setup

Create a `.env` file with your BGG credentials:

```sh
BGG_USERNAME=your_bgg_username
BGG_PASSWORD=your_bgg_password
```

The CLI logs in to `https://boardgamegeek.com/login/api/v1` and stores the browser cookies BGG collection endpoints require in `.cache/bgg-collection-auth.json`. Set `BGG_COLLECTION_AUTH_CACHE_PATH` if you want a different cache file.

## Collection CLI

Run the interactive TUI:

```sh
bun run collection
```

The TUI can list owned games, delete one selected collection item, or sync owned games from `src/data/games.json`.

You can also run commands directly:

```sh
bun run collection list
bun run collection list --json
bun run collection delete
bun run collection delete --collid 145365092
bun run collection sync
bun run collection sync src/data/games.json
```

`collection delete` fetches your owned collection and shows a picker by default. Passing `--collid` deletes that collection row without prompting for a row, which is useful for scripts.

## Syncing Owned Games

`bun run collection sync` reads `src/data/games.json` by default. The file must be a JSON array of BGG game objects; every valid object id in the file is synced, including expansions.

The sync flow:

1. Reads BGG object ids from the games JSON file.
2. Fetches your current owned collection page.
3. Skips games that are already owned.
4. Adds missing games through `https://boardgamegeek.com/geekcollection.php`.

## Development

Use Bun for local development:

```sh
bun install
bun test
bun run check
bun run typecheck
```

New collection CLI behavior should be added under `src/app/`, and shared collection logic should live in `src/lib/collection.ts`.

This project should always use Bun APIs instead of Node APIs. For file I/O, use `Bun.file()` for reading, existence checks, and deletes, and `Bun.write()` for writes or copies. Use `Bun.env` for environment variables.
