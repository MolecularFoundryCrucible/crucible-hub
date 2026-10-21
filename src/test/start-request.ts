import {
  createServerEntry,
  getResponseHeaders,
} from "@tanstack/react-start/server"

export type StartRequestScope = {
  run: <T>(action: () => T | Promise<T>) => Promise<T>
  setCookies: () => string[]
}

export function startRequestScope(
  url: string,
  init?: RequestInit
): StartRequestScope {
  let cookies: string[] = []
  return {
    async run<T>(action: () => T | Promise<T>) {
      let outcome = {
        error: new Error("The request scope did not run."),
      } as { error: unknown } | { value: T }
      await createServerEntry({
        fetch: async () => {
          try {
            outcome = { value: await action() }
          } catch (error) {
            outcome = { error }
          }
          cookies = getResponseHeaders().getSetCookie()
          return new Response(null)
        },
      }).fetch(new Request(url, init))
      if ("error" in outcome) throw outcome.error
      return outcome.value
    },
    setCookies: () => cookies,
  }
}
