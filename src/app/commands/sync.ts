import { log } from "@clack/prompts";
import { defineCommand } from "citty";
import {
  DEFAULT_GAMES_PATH,
  readGameIds,
  withCollectionClient,
} from "~/lib/collection.ts";

const syncCommand = defineCommand({
  meta: {
    name: "sync",
    description: "Sync owned BGG games from a games JSON file",
  },
  args: {
    gamesPath: {
      type: "positional",
      description: "Path to games JSON",
      default: DEFAULT_GAMES_PATH,
    },
  },
  async run({ args }) {
    await syncCollection(args.gamesPath);
  },
});

async function syncCollection(gamesPath: string): Promise<void> {
  const gameIds = await readGameIds(gamesPath);

  await withCollectionClient(async (client) => {
    log.info(`Syncing ${gameIds.length} games from ${gamesPath}...`);
    await client.syncOwnedGames(gameIds);
    log.success("Synced owned collection.");
  });
}

export default syncCommand;
