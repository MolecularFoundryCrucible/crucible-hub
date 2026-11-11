type StoredTokens = {
  access_token: string
  refresh_token: string
  access_expires_at: string
  refresh_expires_at: string
  token_type?: string
  user_unique_id: string
  auth_time?: string | null
}

/** The `/oauth/token` answer that yields these stored tokens at the current time. */
export function oauthTokenAnswer(tokens: StoredTokens) {
  const now = Date.now()
  const seconds = (at: string) =>
    Math.max(0, Math.round((Date.parse(at) - now) / 1000))
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: "Bearer",
    expires_in: seconds(tokens.access_expires_at),
    refresh_expires_in: seconds(tokens.refresh_expires_at),
    user_unique_id: tokens.user_unique_id,
    ...(tokens.auth_time
      ? { auth_time: Math.floor(Date.parse(tokens.auth_time) / 1000) }
      : {}),
  }
}

/** The request path, with the grant type for `/oauth/token`. */
export function oauthRoute(
  input: string | URL | Request,
  init?: RequestInit
): string {
  const path = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  ).pathname
  if (path !== "/oauth/token") return path
  const grant = new URLSearchParams(String(init?.body)).get("grant_type")
  return `${path}:${grant ?? "missing"}`
}

export function oauthForm(init?: RequestInit): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(String(init?.body)))
}
