import { describe, expect, test } from "bun:test";

import { buildCookieMap } from "./auth.ts";

describe("buildCookieMap", () => {
  test("keeps live login cookies and skips deleted duplicates", () => {
    const cookies = buildCookieMap([
      "SessionID=geek-auth-token; Path=/; HttpOnly",
      "bggusername=alice; Path=/; Domain=.boardgamegeek.com",
      "bggpassword=hashed-value; Path=/; Domain=.boardgamegeek.com",
      "bggpassword=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/",
    ]);

    expect(cookies).toEqual({
      SessionID: "geek-auth-token",
      bggpassword: "hashed-value",
      bggusername: "alice",
    });
  });
});
