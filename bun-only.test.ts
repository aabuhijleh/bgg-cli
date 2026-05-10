import { describe, expect, test } from "bun:test";

describe("Bun-only runtime APIs", () => {
  test("does not import disallowed runtime APIs from TypeScript files", async () => {
    const matches: string[] = [];
    const disallowedSpecifier = ["no", "de:"].join("");
    const disallowedImportPrefixes = [
      `${'"'}${disallowedSpecifier}`,
      `${"'"}${disallowedSpecifier}`,
    ];

    for await (const path of new Bun.Glob("**/*.ts").scan(".")) {
      const normalizedPath = path.replaceAll("\\", "/");

      if (normalizedPath.includes("node_modules/")) {
        continue;
      }

      const source = await Bun.file(path).text();

      if (disallowedImportPrefixes.some((prefix) => source.includes(prefix))) {
        matches.push(path);
      }
    }

    expect(matches).toEqual([]);
  });

  test("does not use console APIs from TypeScript files", async () => {
    const matches: string[] = [];
    const disallowedApi = ["con", "sole", "."].join("");

    for await (const path of new Bun.Glob("**/*.ts").scan(".")) {
      const normalizedPath = path.replaceAll("\\", "/");

      if (normalizedPath.includes("node_modules/")) {
        continue;
      }

      const source = await Bun.file(path).text();

      if (source.includes(disallowedApi)) {
        matches.push(path);
      }
    }

    expect(matches).toEqual([]);
  });
});
