import { describe, expect, test } from "bun:test";
import { $ } from "bun";

import { UnauthorizedError } from "./auth.ts";
import {
  buildAddOwnedGameBody,
  buildCollectionCookieHeader,
  buildDeleteCollectionItemBody,
  COLLECTION_AUTH_FILENAME,
  CREDENTIALS_FILENAME,
  createCollectionClient,
  DEFAULT_GAMES_PATH,
  extractOwnedGameIds,
  getBggCliConfigDirectory,
  getCollectionAuthCachePath,
  getCredentialsFilePath,
  joinPathSegments,
  parseOwnedCollectionEntries,
  planOwnedCollectionSync,
  runWithCollectionAuth,
} from "./collection.ts";

describe("collection defaults", () => {
  test("reads games from the src data directory by default", () => {
    expect(DEFAULT_GAMES_PATH).toBe("src/data/games.json");
  });

  test("uses the shared bgg-cli config directory for credentials and session cache", () => {
    const directory = "/tmp/mock-home/.config/bgg-cli";

    expect(getCredentialsFilePath({ configDirectory: directory })).toBe(
      joinPathSegments(directory, CREDENTIALS_FILENAME),
    );
    expect(getCollectionAuthCachePath({ configDirectory: directory })).toBe(
      joinPathSegments(directory, COLLECTION_AUTH_FILENAME),
    );
  });

  test("respects XDG_CONFIG_HOME for config directory placement", () => {
    const previous = Bun.env.XDG_CONFIG_HOME;
    Bun.env.XDG_CONFIG_HOME = "/xdg-config";

    try {
      expect(getBggCliConfigDirectory()).toBe(
        joinPathSegments("/xdg-config", "bgg-cli"),
      );
    } finally {
      if (previous === undefined) {
        delete Bun.env.XDG_CONFIG_HOME;
      } else {
        Bun.env.XDG_CONFIG_HOME = previous;
      }
    }
  });
});

describe("collection request bodies", () => {
  test("builds the form body BGG expects for adding an owned game", () => {
    expect(buildAddOwnedGameBody(291453).toString()).toBe(
      "objecttype=thing&objectid=291453&addowned=true&addwish=false&wishlistpriority=1&force=true&ajax=1&action=additem",
    );
  });

  test("builds the form body BGG expects for deleting a collection row", () => {
    expect(buildDeleteCollectionItemBody(145365091).toString()).toBe(
      "ajax=1&action=delete&collid=145365091",
    );
  });
});

describe("extractOwnedGameIds", () => {
  test("extracts every valid game id regardless of subtype", () => {
    expect(
      extractOwnedGameIds([
        { id: 171131, subtype: "boardgame" },
        { id: "239788", subtype: "boardgameexpansion" },
        { id: 178900 },
      ]),
    ).toEqual([171131, 239788, 178900]);
  });
});

describe("parseOwnedCollectionEntries", () => {
  test("extracts collection row ids, object ids, names, and URLs from collection HTML", () => {
    const entries = parseOwnedCollectionEntries(`
      <tr id='row_145365092'>
        <td ondblclick="CE_EditData({
          collid: '145365092',
          objecttype: 'thing',
          objectid: '171131'
        });">
          <a href="/boardgame/171131/captain-sonar" class='primary'>Captain Sonar</a>
        </td>
      </tr>
      <tr id='row_145360206'>
        <td ondblclick="CE_EditData({
          collid: '145360206',
          objecttype: 'thing',
          objectid: '178900'
        });">
          <a class="primary" href="/boardgame/178900/codenames">Codenames</a>
        </td>
      </tr>
    `);

    expect(entries).toEqual([
      {
        collid: 145365092,
        name: "Captain Sonar",
        objectId: 171131,
        url: "https://boardgamegeek.com/boardgame/171131/captain-sonar",
      },
      {
        collid: 145360206,
        name: "Codenames",
        objectId: 178900,
        url: "https://boardgamegeek.com/boardgame/178900/codenames",
      },
    ]);
  });
});

describe("planOwnedCollectionSync", () => {
  test("treats duplicate owned rows as already owned without deleting them", () => {
    expect(
      planOwnedCollectionSync(
        [171131, 178900],
        [
          {
            collid: 145365092,
            name: "Captain Sonar",
            objectId: 171131,
            url: "https://boardgamegeek.com/boardgame/171131/captain-sonar",
          },
          {
            collid: 145365093,
            name: "Captain Sonar",
            objectId: 171131,
            url: "https://boardgamegeek.com/boardgame/171131/captain-sonar",
          },
        ],
      ),
    ).toEqual({
      objectIdsToAdd: [178900],
      objectIdsToSkip: [171131],
    });
  });
});

describe("createCollectionClient", () => {
  test("fetches every owned collection item without limiting by subtype", async () => {
    const requestedUrls: string[] = [];
    const client = createCollectionClient({
      cookies: {
        SessionID: "session-token",
        bggpassword: "hashed-password",
        bggusername: "alice",
      },
      fetch: async (input) => {
        requestedUrls.push(String(input));

        return new Response("");
      },
      username: "alice",
    });

    await client.listOwnedCollectionEntries();

    const url = new URL(requestedUrls[0] ?? "");
    expect(url.searchParams.get("own")).toBe("1");
    expect(url.searchParams.has("subtype")).toBe(false);
  });
});

describe("collection auth", () => {
  test("sends every live browser login cookie needed by collection utilities", () => {
    expect(
      buildCollectionCookieHeader({
        SessionID: "session-token",
        bggpassword: "hashed-password",
        bggusername: "fiction_bgc",
      }),
    ).toBe(
      "bggusername=fiction_bgc; bggpassword=hashed-password; SessionID=session-token",
    );
  });

  test("refreshes cached cookies once when a collection endpoint is unauthorized", async () => {
    const directory = createTempDirectoryPath("bgg-cache");
    const cachePath = `${directory}/auth.json`;

    await $`mkdir -p ${directory}`.quiet();
    await Bun.write(
      cachePath,
      `${JSON.stringify({
        cookies: {
          SessionID: "stale-session",
          bggpassword: "stale-password",
          bggusername: "alice",
        },
      })}\n`,
    );

    const loginResponses = [
      new Response(null, {
        headers: {
          "set-cookie":
            "SessionID=fresh-session; Path=/; HttpOnly, bggusername=alice; Path=/; Domain=.boardgamegeek.com, bggpassword=fresh-password; Path=/; Domain=.boardgamegeek.com",
        },
      }),
    ];
    const cookieHeaders: string[] = [];

    try {
      const result = await runWithCollectionAuth(
        async (cookies) => {
          cookieHeaders.push(buildCollectionCookieHeader(cookies));

          if (cookieHeaders.length === 1) {
            throw new UnauthorizedError("stale cookies");
          }

          return "ok";
        },
        {
          cachePath,
          fetch: async () => loginResponses.shift() ?? new Response(null),
          password: "secret",
          username: "alice",
        },
      );

      expect(result).toBe("ok");
      expect(cookieHeaders).toEqual([
        "bggusername=alice; bggpassword=stale-password; SessionID=stale-session",
        "bggusername=alice; bggpassword=fresh-password; SessionID=fresh-session",
      ]);
      await expect(Bun.file(cachePath).text()).resolves.toContain(
        "fresh-session",
      );
    } finally {
      await $`rm -rf ${directory}`.quiet();
    }
  });
});

function createTempDirectoryPath(prefix: string): string {
  const tempRoot = Bun.env.TEMP ?? Bun.env.TMP ?? ".cache";

  return `${tempRoot.replace(/[\\/]$/, "")}/${prefix}-${crypto.randomUUID()}`;
}
