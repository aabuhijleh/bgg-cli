import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import {
  type OwnedCollectionEntry,
  withCollectionClient,
} from "../../lib/collection.ts";
import { appCollectionAuthOptions } from "../credentials.ts";
import {
  formatCollectionEntry,
  parsePositiveInteger,
  withSpinner,
} from "./shared.ts";

const deleteCommand = defineCommand({
  meta: {
    name: "delete",
    description: "Delete an item from the owned BGG collection",
  },
  args: {
    collid: {
      type: "string",
      description: "Collection row id to delete without prompting",
    },
  },
  async run({ args }) {
    await deleteCollection(args.collid);
  },
});

async function deleteCollection(collidText?: string): Promise<void> {
  await withCollectionClient(async (client) => {
    const entries = await withSpinner(
      "Fetching owned collection...",
      () => client.listOwnedCollectionEntries(),
      "Fetched owned collection.",
    );
    const collid =
      collidText === undefined
        ? await promptForCollectionRow(entries)
        : parsePositiveInteger(collidText, "collid");

    if (collid === undefined) {
      return;
    }

    const entry = entries.find((candidate) => candidate.collid === collid);
    const label = entry ? formatCollectionEntry(entry) : `collid ${collid}`;

    if (collidText === undefined) {
      const confirmed = await p.confirm({
        message: `Delete ${label}?`,
        initialValue: false,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel("Delete cancelled.");
        return;
      }
    }

    await withSpinner(
      `Deleting ${label}...`,
      () => client.deleteCollectionItem(collid),
      `Deleted ${label}.`,
    );
  }, appCollectionAuthOptions);
}

async function promptForCollectionRow(
  entries: OwnedCollectionEntry[],
): Promise<number | undefined> {
  if (entries.length === 0) {
    throw new Error("No owned collection items found");
  }

  const collid = await p.select<number>({
    message: "Which item should be deleted?",
    options: entries.map((entry) => ({
      value: entry.collid,
      label: entry.name,
      hint: `#${entry.objectId}, collid ${entry.collid}`,
    })),
  });

  if (p.isCancel(collid)) {
    p.cancel("Operation cancelled.");
    return undefined;
  }

  return collid;
}

export default deleteCommand;
