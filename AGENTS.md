# BGG Agent Guide

## Runtime and APIs

- This is a Bun-first TypeScript project. Run scripts with `bun run`, tests with `bun test`, and checks with `bun run check` / `bun run typecheck`.
- Never use `node:` imports or Node-specific filesystem/process APIs. Use Bun APIs instead, especially `Bun.file()` for reads/existence/deletes and `Bun.write()` for writes/copies.
- Use `Bun.env` for environment variables. If Bun does not provide an API you need, ask before introducing a Node API.
- Never use `console.*` APIs. They do not play well with Clack prompts; use Clack's `log` helpers such as `log.message()`, `log.info()`, or `log.error()`.

## Project Layout

- `src/app/collection.ts` is the CLI entrypoint for list, delete, and sync behavior.
- `src/lib/collection.ts` owns BoardGameGeek collection auth, cookie caching, request helpers, parsing, and sync planning.
- `src/data/games.json` is the default sync source. Keep it as a JSON array of BGG game objects.

## BGG Collection Auth

- Use the shared collection helpers in `src/lib/collection.ts` for all BoardGameGeek collection endpoints. Do not repeat login, cookie-cache, refresh, or request-header logic in apps or scripts.
- Collection endpoints use browser login cookies, not a `GeekAuth` bearer-style token. Login posts `BGG_USERNAME` and `BGG_PASSWORD` to `https://boardgamegeek.com/login/api/v1` and must capture `bggusername`, `bggpassword`, and `SessionID` from `Set-Cookie`.
- Authenticated collection requests send those three cookies as `Cookie: bggusername=...; bggpassword=...; SessionID=...`.
- Cookies are cached at `.cache/bgg-collection-auth.json`.
- If BGG returns `401` or HTML that points at `/login`, treat the cache as stale, delete it, log in once, and retry the operation once through `runWithCollectionAuth()`.

## Change Guidelines

- Prefer focused changes that preserve the CLI contracts documented in `README.md`.
- Add shared behavior to `src/lib/collection.ts`; keep `src/app/collection.ts` mostly responsible for arguments, prompts, spinners, and output.
- When changing collection behavior, update or add `bun test` coverage near `src/lib/collection.test.ts`.
