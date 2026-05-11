# BGG Agent Guide

## Runtime and APIs

- This is a Bun-first TypeScript project. Run scripts with `bun run`, tests with `bun test`, and checks with `bun run check` / `bun run typecheck`.
- Prefer Bun APIs for filesystem I/O (`Bun.file()`, `Bun.write()`). The only allowed `node:` import is `mkdir` from `node:fs/promises` for recursive parent directories (no shell `mkdir`).
- Otherwise avoid `node:` imports and Node-specific process APIs unless Bun lacks an alternative—ask first.
- Use `Bun.env` only for ambient environment values such as `HOME`, `USERPROFILE`, or `XDG_CONFIG_HOME` (not BGG secrets).
- Never use `console.*` APIs. They do not play well with Clack prompts; use Clack's `log` helpers such as `log.message()`, `log.info()`, or `log.error()`.

## Project Layout

- `src/app/collection.ts` is the CLI entrypoint for list, delete, and sync behavior.
- `src/app/credentials.ts` holds the interactive BGG sign-in prompt wired into collection auth options.
- `src/lib/collection.ts` owns BoardGameGeek collection auth, cookie caching, request helpers, parsing, and sync planning.
- `src/data/games.json` is the default sync source. Keep it as a JSON array of BGG game objects.

## BGG Collection Auth

- Use the shared collection helpers in `src/lib/collection.ts` for all BoardGameGeek collection endpoints. Do not repeat login, cookie-cache, refresh, or request-header logic in apps or scripts.
- Collection endpoints use browser login cookies, not a `GeekAuth` bearer-style token. Login posts the user's username and password to `https://boardgamegeek.com/login/api/v1` and must capture `bggusername`, `bggpassword`, and `SessionID` from `Set-Cookie`.
- Authenticated collection requests send those three cookies as `Cookie: bggusername=...; bggpassword=...; SessionID=...`.
- The CLI stores saved credentials and session cache under the user config directory (default `~/.config/bgg-cli/` — or `$XDG_CONFIG_HOME/bgg-cli/` when `XDG_CONFIG_HOME` is set): `credentials.json` and `collection-auth.json`.
- If BGG returns `401` or HTML that points at `/login`, treat the cache as stale, delete it, log in once, and retry the operation once through `runWithCollectionAuth()`.

## Change Guidelines

- Prefer focused changes that preserve the CLI contracts documented in `README.md`.
- Add shared behavior to `src/lib/collection.ts`; keep `src/app/collection.ts` mostly responsible for arguments, prompts, spinners, and output.
- When changing collection behavior, update or add `bun test` coverage near `src/lib/collection.test.ts`.
