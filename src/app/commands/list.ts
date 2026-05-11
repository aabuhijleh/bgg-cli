import { log } from "@clack/prompts";
import { defineCommand } from "citty";
import { withCollectionClient } from "../../lib/collection.ts";
import { appCollectionAuthOptions } from "../credentials.ts";
import {
  formatCollectionCount,
  formatCollectionEntry,
  withSpinner,
} from "./shared.ts";

const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List owned BGG collection items",
  },
  args: {
    json: {
      type: "boolean",
      description: "Print collection rows as JSON",
    },
  },
  async run({ args }) {
    await listCollection({ json: args.json === true });
  },
});

async function listCollection(options: { json: boolean }): Promise<void> {
  await withCollectionClient(async (client) => {
    const entries = await withSpinner(
      "Fetching owned collection...",
      () => client.listOwnedCollectionEntries(),
      "Fetched owned collection.",
    );

    if (options.json) {
      log.message(JSON.stringify(entries, null, 2));
      return;
    }

    log.message(formatCollectionCount(entries.length));

    for (const entry of entries) {
      log.message(formatCollectionEntry(entry));
    }
  }, appCollectionAuthOptions);
}

export default listCommand;
