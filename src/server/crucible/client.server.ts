import "@tanstack/react-start/server-only"

import createClient from "openapi-fetch"

import type { paths } from "@/generated/crucible-api"

type ClientConfiguration = {
  baseUrl: string
  bearerToken: string
  fetch?: typeof globalThis.fetch
}

export function createCrucibleClient({
  baseUrl,
  bearerToken,
  fetch,
}: ClientConfiguration) {
  return createClient<paths>({
    baseUrl,
    fetch,
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  })
}
