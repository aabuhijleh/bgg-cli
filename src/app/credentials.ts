import * as p from "@clack/prompts";

import {
  COLLECTION_AUTH_FILENAME,
  type CollectionAuthOptions,
  CREDENTIALS_FILENAME,
  getBggCliConfigDirectory,
} from "~/lib/collection.ts";

export async function promptBggCredentials(): Promise<{
  password: string;
  username: string;
}> {
  p.log.info(
    `First-time sign-in: credentials and session cache are stored in ${getBggCliConfigDirectory()} (${CREDENTIALS_FILENAME}, ${COLLECTION_AUTH_FILENAME}).`,
  );

  const username = await p.text({
    message: "BoardGameGeek username",
    placeholder: "Your BGG login name",
    validate: (value) =>
      (value ?? "").trim().length > 0 ? undefined : "Username is required",
  });

  if (p.isCancel(username)) {
    p.cancel("Sign-in cancelled.");
    throw new Error("Sign-in cancelled.");
  }

  const password = await p.password({
    message: "BoardGameGeek password",
    validate: (value) =>
      (value ?? "").length > 0 ? undefined : "Password is required",
  });

  if (p.isCancel(password)) {
    p.cancel("Sign-in cancelled.");
    throw new Error("Sign-in cancelled.");
  }

  return {
    password,
    username: username.trim(),
  };
}

export const appCollectionAuthOptions: Pick<
  CollectionAuthOptions,
  "promptCredentials"
> = {
  promptCredentials: promptBggCredentials,
};
