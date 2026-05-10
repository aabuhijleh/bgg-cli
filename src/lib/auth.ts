type LoginCookies = Record<string, string>;

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function buildCookieMap(setCookieHeaders: string[]): LoginCookies {
  const cookies: LoginCookies = {};

  for (const header of setCookieHeaders) {
    const [cookiePair] = header.split(";");
    const separatorIndex = cookiePair?.indexOf("=") ?? -1;

    if (separatorIndex <= 0 || !cookiePair) {
      continue;
    }

    const name = cookiePair.slice(0, separatorIndex).trim();
    const value = cookiePair.slice(separatorIndex + 1).trim();

    if (!value || isDeletedCookie(header, value)) {
      continue;
    }

    cookies[name] = value;
  }

  return cookies;
}

function isDeletedCookie(header: string, value: string): boolean {
  return (
    value === "deleted" ||
    /expires=Thu, 01 Jan 1970/i.test(header) ||
    /Max-Age=0/i.test(header)
  );
}
