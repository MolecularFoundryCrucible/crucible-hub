import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import {
  issueWorkspaceUserPasswordLink,
  removeWorkspaceUserPassword,
  setWorkspaceAccountPassword,
} from "./passwords.server"
import { queryCancellationMiddleware } from "./query-cancellation"

const userIdSchema = z.string().trim().min(1).max(255)
const passwordSchema = z.string().min(1).max(1024)

export const setWorkspaceAccountPasswordFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        currentPassword: passwordSchema.optional(),
        newPassword: passwordSchema,
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      setWorkspaceAccountPassword(data, context.requestSignal)
    )
  })

export const issueWorkspaceUserPasswordLinkFn = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        scenario: fixtureScenarioSchema.optional(),
        userId: userIdSchema,
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      issueWorkspaceUserPasswordLink(
        data.userId,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const removeWorkspaceUserPasswordFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z.object({ self: z.boolean().optional(), userId: userIdSchema }).strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      removeWorkspaceUserPassword(
        data.self
          ? { kind: "self", userId: data.userId }
          : { kind: "user", userId: data.userId },
        context.requestSignal
      )
    )
  })
