import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { queryCancellationMiddleware } from "./query-cancellation"
import {
  approveWorkspaceUser,
  readWorkspacePendingUsers,
  rejectWorkspaceUser,
} from "./user-approvals.server"

const userInputSchema = z
  .object({ userId: z.string().trim().min(1).max(255) })
  .strict()

export const getWorkspacePendingUsers = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspacePendingUsers(context.requestSignal)
    )
  })

export const approveWorkspaceUserFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(userInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      approveWorkspaceUser(data.userId, context.requestSignal)
    )
  })

export const rejectWorkspaceUserFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(userInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      rejectWorkspaceUser(data.userId, context.requestSignal)
    )
  })
