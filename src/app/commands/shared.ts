import * as p from "@clack/prompts";

import type { OwnedCollectionEntry } from "../../lib/collection.ts";

export function parsePositiveInteger(
  value: string | undefined,
  fieldName: string,
): number {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`Set ${fieldName} to a positive integer`);
  }

  return numberValue;
}

export function formatCollectionEntry(entry: OwnedCollectionEntry): string {
  return `${entry.name} (#${entry.objectId}, collid ${entry.collid})`;
}

export function formatCollectionCount(count: number): string {
  const label = count === 1 ? "item" : "items";

  return `${count} owned collection ${label}`;
}

export async function withSpinner<T>(
  startMessage: string,
  action: () => Promise<T>,
  stopMessage: string,
): Promise<T> {
  const spinner = p.spinner();
  spinner.start(startMessage);

  try {
    const result = await action();
    spinner.stop(stopMessage);
    return result;
  } catch (error) {
    spinner.stop("Failed.");
    throw error;
  }
}
