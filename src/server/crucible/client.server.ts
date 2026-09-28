import "@tanstack/react-start/server-only"

import createClient from "openapi-fetch"

import type { WorkspacePrivilegeMode } from "@/data/crucible/privilege-mode"
import type { paths } from "@/generated/crucible-api"

import { readGlobalPrivilegeMode } from "./privilege-mode.server"

type ClientConfiguration = {
  baseUrl: string
  bearerToken?: string
  fetch?: typeof globalThis.fetch
}

type ClientAuthority = {
  privilegeMode?: WorkspacePrivilegeMode
}

export class CruciblePrivilegeModeError extends Error {
  constructor(
    readonly requestedMode: WorkspacePrivilegeMode,
    readonly appliedMode: string | null
  ) {
    super("The Crucible API did not apply the requested privilege mode.")
    this.name = "CruciblePrivilegeModeError"
  }
}

export function createCrucibleClient(
  { baseUrl, bearerToken, fetch }: ClientConfiguration,
  authority: ClientAuthority = {}
) {
  const privilegeMode = authority.privilegeMode ?? readGlobalPrivilegeMode()
  const client = createClient<paths>({
    baseUrl,
    fetch,
    headers: {
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      "Crucible-Privilege-Mode": privilegeMode,
    },
  })
  client.use({
    onResponse({ response }) {
      const appliedMode = response.headers.get("Crucible-Privilege-Mode")
      if (
        (response.ok && appliedMode !== privilegeMode) ||
        (appliedMode !== null && appliedMode !== privilegeMode)
      ) {
        throw new CruciblePrivilegeModeError(privilegeMode, appliedMode)
      }
    },
  })
  return client
}
