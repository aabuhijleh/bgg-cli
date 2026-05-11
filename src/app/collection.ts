#! /usr/bin/env bun

import { defineCommand, runMain } from "citty";

export const main = defineCommand({
  meta: {
    name: "collection",
    version: "1.0.0",
    description: "Manage your BoardGameGeek owned collection",
  },
  default: "list",
  subCommands: {
    delete: () =>
      import("./commands/delete.ts").then((module) => module.default),
    list: () => import("./commands/list.ts").then((module) => module.default),
    sync: () => import("./commands/sync.ts").then((module) => module.default),
  },
});

runMain(main);
