import "@tanstack/react-start/server-only"

import { requireAdministratorView } from "@/server/crucible/privilege-mode.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import { toWorkspaceAdminUser } from "./users.server"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import type { WorkspaceAdminUser } from "./workspace-source"

const pendingUserLimit = 50

function adminClient() {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  if (configuration.mode === "fixture") return null
  return createCrucibleClient(configuration, {
    privilegeMode: requireAdministratorView(),
  })
}

export async function readWorkspacePendingUsers(
  requestSignal?: AbortSignal
): Promise<{ items: WorkspaceAdminUser[]; total: number | null }> {
  const client = adminClient()
  if (!client) return { items: [], total: 0 }
  const result = await client.GET("/users", {
    params: {
      query: {
        direction: "asc",
        include_total: true,
        limit: pendingUserLimit,
        pending: true,
      },
    },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return {
    items: result.data.items.map(toWorkspaceAdminUser),
    total: result.data.total ?? null,
  }
}

export async function approveWorkspaceUser(
  userId: string,
  requestSignal?: AbortSignal
): Promise<WorkspaceAdminUser> {
  const client = adminClient()
  if (!client) throw new CrucibleResponseError(403)
  const result = await client.POST("/users/{user_ref}/approve", {
    params: { path: { user_ref: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return toWorkspaceAdminUser(result.data)
}

export async function rejectWorkspaceUser(
  userId: string,
  requestSignal?: AbortSignal
) {
  const client = adminClient()
  if (!client) throw new CrucibleResponseError(403)
  const result = await client.POST("/users/{user_ref}/reject", {
    params: { path: { user_ref: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}
