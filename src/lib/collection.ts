import { log } from "@clack/prompts";
import { $ } from "bun";

import { buildCookieMap, UnauthorizedError } from "./auth.ts";

export const BGG_ORIGIN = "https://boardgamegeek.com";
export const DEFAULT_GAMES_PATH = "src/data/games.json";
export const DEFAULT_COLLECTION_AUTH_CACHE_PATH =
  ".cache/bgg-collection-auth.json";

type UnknownRecord = Record<string, unknown>;
type Fetch = (
  input: Request | URL | string,
  init?: RequestInit,
) => Promise<Response>;

export type CollectionCookies = {
  SessionID: string;
  bggpassword: string;
  bggusername: string;
};

export type CollectionAuthOptions = {
  cachePath?: string;
  fetch?: Fetch;
  password?: string;
  username?: string;
};

export type CollectionClientOptions = {
  cookies: CollectionCookies;
  fetch?: Fetch;
  username: string;
};

export type OwnedCollectionEntry = {
  collid: number;
  name: string;
  objectId: number;
  url: string;
};

export type CollectionLogger = (message: string) => void;

export function extractOwnedGameIds(gamesJson: unknown): number[] {
  if (!Array.isArray(gamesJson)) {
    throw new Error("Games JSON must be an array");
  }

  return gamesJson.map((entry) => {
    const game = asRecord(entry);

    if (!game) {
      throw new Error("Game entry must be an object");
    }

    const gameId = Number(game.id);

    if (!Number.isInteger(gameId) || gameId <= 0) {
      throw new Error(
        `Game entry has invalid BGG object id: ${String(game.id)}`,
      );
    }

    return gameId;
  });
}

export function buildAddOwnedGameBody(objectId: number): URLSearchParams {
  return new URLSearchParams({
    objecttype: "thing",
    objectid: String(objectId),
    addowned: "true",
    addwish: "false",
    wishlistpriority: "1",
    force: "true",
    ajax: "1",
    action: "additem",
  });
}

export function buildDeleteCollectionItemBody(collid: number): URLSearchParams {
  return new URLSearchParams({
    ajax: "1",
    action: "delete",
    collid: String(collid),
  });
}

export function parseOwnedCollectionEntries(
  html: string,
): OwnedCollectionEntry[] {
  const entriesByCollid = new Map<number, OwnedCollectionEntry>();
  const entryPattern =
    /collid:\s*['"](\d+)['"][\s\S]*?objectid:\s*['"](\d+)['"]([\s\S]*?)(?=collid:\s*['"]\d+['"]|$)/g;

  for (const match of html.matchAll(entryPattern)) {
    const collid = Number(match[1]);
    const objectId = Number(match[2]);
    const tailHtml = match[3] ?? "";
    const anchor = extractPrimaryAnchor(tailHtml);

    if (
      Number.isInteger(collid) &&
      Number.isInteger(objectId) &&
      anchor !== undefined
    ) {
      entriesByCollid.set(collid, {
        collid,
        name: decodeHtml(anchor.name),
        objectId,
        url: new URL(anchor.href, BGG_ORIGIN).toString(),
      });
    }
  }

  return [...entriesByCollid.values()];
}

export function planOwnedCollectionSync(
  objectIds: number[],
  entries: OwnedCollectionEntry[],
): {
  objectIdsToAdd: number[];
  objectIdsToSkip: number[];
} {
  const targetObjectIds = [...new Set(objectIds)];
  const entriesByObjectId = new Map<number, OwnedCollectionEntry[]>();

  for (const entry of entries) {
    if (!targetObjectIds.includes(entry.objectId)) {
      continue;
    }

    const existingEntries = entriesByObjectId.get(entry.objectId) ?? [];
    existingEntries.push(entry);
    entriesByObjectId.set(entry.objectId, existingEntries);
  }

  return {
    objectIdsToAdd: targetObjectIds.filter(
      (objectId) => !entriesByObjectId.has(objectId),
    ),
    objectIdsToSkip: targetObjectIds.filter((objectId) =>
      entriesByObjectId.has(objectId),
    ),
  };
}

export function buildCollectionCookieHeader(
  cookies: CollectionCookies,
): string {
  return [
    `bggusername=${cookies.bggusername}`,
    `bggpassword=${cookies.bggpassword}`,
    `SessionID=${cookies.SessionID}`,
  ].join("; ");
}

export async function assertCollectionResponse(
  response: Response,
  description: string,
): Promise<string> {
  const responseText = await response.text();

  if (response.status === 401 || responseText.includes("/login")) {
    throw new UnauthorizedError(`BGG says ${description} is not logged in`);
  }

  if (!response.ok) {
    throw new Error(
      `BGG ${description} failed with HTTP ${response.status} ${response.statusText}`,
    );
  }

  return responseText;
}

export async function assertAddOwnedGameResponse(
  response: Response,
  objectId: number,
): Promise<void> {
  await assertCollectionResponse(
    response,
    `collection request for ${objectId}`,
  );
}

export async function readGameIds(gamesPath: string): Promise<number[]> {
  return extractOwnedGameIds(await Bun.file(gamesPath).json());
}

export async function runWithCollectionAuth<T>(
  operation: (cookies: CollectionCookies) => Promise<T>,
  options: CollectionAuthOptions = {},
): Promise<T> {
  const cachePath =
    options.cachePath ??
    Bun.env.BGG_COLLECTION_AUTH_CACHE_PATH ??
    DEFAULT_COLLECTION_AUTH_CACHE_PATH;
  const cookies = await getCollectionCookies(cachePath, options);

  try {
    return await operation(cookies);
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      throw error;
    }

    await deleteFileIfExists(cachePath);
    const refreshedCookies = await loginAndCacheCollectionCookies(
      cachePath,
      options,
    );

    return operation(refreshedCookies);
  }
}

export function createCollectionClient(options: CollectionClientOptions): {
  addOwnedGame: (objectId: number) => Promise<void>;
  deleteCollectionItem: (collid: number) => Promise<void>;
  listOwnedCollectionEntries: () => Promise<OwnedCollectionEntry[]>;
  syncOwnedGames: (
    objectIds: number[],
    logger?: CollectionLogger,
  ) => Promise<void>;
} {
  const fetchImpl = options.fetch ?? fetch;
  const cookieHeader = buildCollectionCookieHeader(options.cookies);

  async function addOwnedGame(objectId: number): Promise<void> {
    const response = await fetchImpl(`${BGG_ORIGIN}/geekcollection.php`, {
      method: "POST",
      headers: buildCollectionMutationHeaders(cookieHeader, options.username),
      body: buildAddOwnedGameBody(objectId),
    });

    await assertAddOwnedGameResponse(response, objectId);
  }

  async function deleteCollectionItem(collid: number): Promise<void> {
    const response = await fetchImpl(`${BGG_ORIGIN}/geekcollection.php`, {
      method: "POST",
      headers: buildCollectionMutationHeaders(cookieHeader, options.username),
      body: buildDeleteCollectionItemBody(collid),
    });

    await assertCollectionResponse(
      response,
      `delete request for collid ${collid}`,
    );
  }

  async function listOwnedCollectionEntries(): Promise<OwnedCollectionEntry[]> {
    const url = new URL(`/collection/user/${options.username}`, BGG_ORIGIN);
    url.searchParams.set("own", "1");

    const response = await fetchImpl(url, {
      headers: {
        Cookie: cookieHeader,
        "User-Agent": "bgg-collection-cli/1.0",
      },
    });
    const responseText = await assertCollectionResponse(
      response,
      "collection page request",
    );

    return parseOwnedCollectionEntries(responseText);
  }

  async function syncOwnedGames(
    objectIds: number[],
    logger: CollectionLogger = log.message,
  ): Promise<void> {
    const collectionEntries = await listOwnedCollectionEntries();
    const { objectIdsToAdd, objectIdsToSkip } = planOwnedCollectionSync(
      objectIds,
      collectionEntries,
    );

    for (const objectId of objectIdsToSkip) {
      logger(`Skipped ${objectId}; already owned`);
    }

    for (const objectId of objectIdsToAdd) {
      await addOwnedGame(objectId);
      logger(`Added ${objectId} as owned`);
    }
  }

  return {
    addOwnedGame,
    deleteCollectionItem,
    listOwnedCollectionEntries,
    syncOwnedGames,
  };
}

export async function withCollectionClient<T>(
  operation: (client: ReturnType<typeof createCollectionClient>) => Promise<T>,
  options: CollectionAuthOptions = {},
): Promise<T> {
  const username = options.username ?? Bun.env.BGG_USERNAME;

  if (!username) {
    throw new Error("Set BGG_USERNAME before running this script");
  }

  return runWithCollectionAuth(
    (cookies) =>
      operation(
        createCollectionClient({
          cookies,
          fetch: options.fetch,
          username,
        }),
      ),
    options,
  );
}

async function getCollectionCookies(
  cachePath: string,
  options: CollectionAuthOptions,
): Promise<CollectionCookies> {
  const cachedCookies = await readCachedCollectionCookies(cachePath);

  if (cachedCookies) {
    return cachedCookies;
  }

  return loginAndCacheCollectionCookies(cachePath, options);
}

async function loginAndCacheCollectionCookies(
  cachePath: string,
  options: CollectionAuthOptions,
): Promise<CollectionCookies> {
  const username = options.username ?? Bun.env.BGG_USERNAME;
  const password = options.password ?? Bun.env.BGG_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Set BGG_USERNAME and BGG_PASSWORD before running this script",
    );
  }

  const cookies = await loginToBggCollectionCookies(
    username,
    password,
    options,
  );
  await writeCachedCollectionCookies(cachePath, cookies);

  return cookies;
}

async function readCachedCollectionCookies(
  cachePath: string,
): Promise<CollectionCookies | undefined> {
  try {
    return asCollectionCookies(await Bun.file(cachePath).json());
  } catch {
    return undefined;
  }
}

async function writeCachedCollectionCookies(
  cachePath: string,
  cookies: CollectionCookies,
): Promise<void> {
  await ensureParentDirectory(cachePath);
  await Bun.write(cachePath, `${JSON.stringify({ cookies }, null, 2)}\n`);
}

async function deleteFileIfExists(path: string): Promise<void> {
  const file = Bun.file(path);

  if (await file.exists()) {
    await file.delete();
  }
}

async function ensureParentDirectory(path: string): Promise<void> {
  const directory = getParentDirectory(path);

  if (!directory) {
    return;
  }

  await $`mkdir -p ${directory}`.quiet();
}

function getParentDirectory(path: string): string | undefined {
  const normalizedPath = path.replaceAll("\\", "/");
  const lastSeparatorIndex = normalizedPath.lastIndexOf("/");

  if (lastSeparatorIndex < 0) {
    return undefined;
  }

  if (lastSeparatorIndex === 0) {
    return normalizedPath.slice(0, 1);
  }

  return normalizedPath.slice(0, lastSeparatorIndex);
}

async function loginToBggCollectionCookies(
  username: string,
  password: string,
  options: CollectionAuthOptions,
): Promise<CollectionCookies> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`${BGG_ORIGIN}/login/api/v1`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/json",
      Origin: BGG_ORIGIN,
      Referer: `${BGG_ORIGIN}/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0",
    },
    body: JSON.stringify({
      credentials: {
        username,
        password,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `BGG login failed with HTTP ${response.status} ${response.statusText}`,
    );
  }

  const cookies = asCollectionCookies({
    cookies: buildCookieMap(getSetCookieHeaders(response.headers)),
  });

  if (!cookies) {
    throw new Error(
      "BGG login did not return bggusername, bggpassword, and SessionID cookies",
    );
  }

  return cookies;
}

function buildCollectionMutationHeaders(
  cookieHeader: string,
  username: string,
): Record<string, string> {
  return {
    Accept: "text/javascript, text/html, application/xml, text/xml, */*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Cookie: cookieHeader,
    Origin: BGG_ORIGIN,
    Referer: `${BGG_ORIGIN}/collection/user/${username}`,
    "User-Agent": "bgg-collection-cli/1.0",
    "X-Requested-With": "XMLHttpRequest",
  };
}

function asCollectionCookies(value: unknown): CollectionCookies | undefined {
  const record = asRecord(value);
  const cookies = asRecord(record?.cookies);

  if (
    typeof cookies?.bggusername !== "string" ||
    typeof cookies.bggpassword !== "string" ||
    typeof cookies.SessionID !== "string"
  ) {
    return undefined;
  }

  return {
    SessionID: cookies.SessionID,
    bggpassword: cookies.bggpassword,
    bggusername: cookies.bggusername,
  };
}

function extractPrimaryAnchor(
  html: string,
): { href: string; name: string } | undefined {
  const anchorPattern =
    /<a\b(?=[^>]*\bclass=["'][^"']*\bprimary\b)(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/i;
  const anchor = html.match(anchorPattern);

  if (!anchor?.[1] || !anchor[2]) {
    return undefined;
  }

  return {
    href: anchor[1],
    name: stripTags(anchor[2]).trim(),
  };
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookieHeaders = headersWithGetSetCookie.getSetCookie?.();

  if (setCookieHeaders && setCookieHeaders.length > 0) {
    return setCookieHeaders.flatMap(splitCombinedSetCookieHeader);
  }

  const singleHeader = headers.get("set-cookie");

  return singleHeader ? splitCombinedSetCookieHeader(singleHeader) : [];
}

function splitCombinedSetCookieHeader(header: string): string[] {
  return header.split(/,(?=\s*[^;,=\s]+=)/).map((value) => value.trim());
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : undefined;
}
