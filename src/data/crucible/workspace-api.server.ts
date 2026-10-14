import "@tanstack/react-start/server-only"

import type {
  Workspace,
  WorkspaceSource,
} from "@/data/crucible/workspace-source"
import { createCrucibleClient } from "@/server/crucible/client.server"
import { crucibleRequestSignal } from "@/server/crucible/request-signal.server"
import {
  readUploadIngestionEnabled,
  readAccountPreferencesEnabled,
  readUploadsEnabled,
} from "./workspace-config.server"
import type { WorkspacePrivilegeMode } from "./privilege-mode"

type ApiWorkspaceConfiguration = {
  baseUrl: string
  bearerToken?: string
  fetch?: typeof globalThis.fetch
  now?: () => Date
  signal?: AbortSignal
  privilegeMode?: WorkspacePrivilegeMode
}

type ApiFailure = {
  label: string
  status: number
}

function failure(label: string, response: Response): ApiFailure {
  return { label, status: response.status }
}

function unavailable(error: unknown): WorkspaceSource {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return {
      status: "unavailable",
      reason: "The Crucible API did not respond before the local timeout.",
    }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "label" in error &&
    "status" in error
  ) {
    const apiFailure = error as ApiFailure
    return {
      status: "unavailable",
      reason: `The Crucible API rejected the ${apiFailure.label} request (${apiFailure.status}).`,
    }
  }

  return {
    status: "unavailable",
    reason: "The local Hub server could not reach the Crucible API.",
  }
}

export async function readWorkspaceFromApi({
  baseUrl,
  bearerToken,
  fetch,
  now = () => new Date(),
  privilegeMode = "normal",
  signal,
}: ApiWorkspaceConfiguration): Promise<WorkspaceSource> {
  try {
    const client = createCrucibleClient(
      { baseUrl, bearerToken, fetch },
      { privilegeMode }
    )
    const accountResult = await client.GET("/account/profile", {
      signal: crucibleRequestSignal(signal),
    })

    if (!accountResult.data) {
      throw failure("account", accountResult.response)
    }

    const account = {
      authorization: accountResult.data.authorization,
      capabilities: accountResult.data.capabilities,
      email: accountResult.data.email,
      unique_id: accountResult.data.unique_id,
      username: accountResult.data.username,
      first_name: accountResult.data.first_name,
      is_service_account: accountResult.data.is_service_account ?? false,
      last_name: accountResult.data.last_name,
    }
    const workspace: Workspace = {
      id: account.unique_id,
      referenceTime: now().toISOString(),
      account,
      people: [account],
      projects: [],
      instruments: [],
      samples: [],
      datasets: [],
      files: [],
    }

    return {
      status: "ready",
      mode: "api",
      accountPreferencesEnabled: readAccountPreferencesEnabled("api"),
      privilegeMode,
      uploadIngestionEnabled: readUploadIngestionEnabled("api"),
      uploadsEnabled: readUploadsEnabled("api"),
      workspace,
    }
  } catch (error) {
    return unavailable(error)
  }
}
