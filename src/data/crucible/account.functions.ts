import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import {
  checkWorkspaceUsernameExactMatch,
  patchWorkspaceAccount,
  readWorkspaceAccount,
  readWorkspaceAccountCredentialStatus,
} from "./account.server"
import { queryCancellationMiddleware } from "./query-cancellation"
import { usernameSchema } from "./slugs"

const profileNameSchema = z.string().trim().max(255).nullable()
const profileEmailSchema = z.string().trim().email().max(320).nullable()
const profileUsernameSchema = usernameSchema.nullable()

export const accountProfileUpdateInputSchema = z
  .object({
    changes: z
      .object({
        email: profileEmailSchema.optional(),
        first_name: profileNameSchema.optional(),
        last_name: profileNameSchema.optional(),
        username: profileUsernameSchema.optional(),
      })
      .strict()
      .refine(
        (changes) => Object.keys(changes).length > 0,
        "At least one profile change is required."
      ),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const getWorkspaceAccount = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ scenario: fixtureScenarioSchema.optional() }))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceAccount(data.scenario, context.requestSignal)
    )
  })

export const getWorkspaceAccountCredentialStatus = createServerFn({
  method: "GET",
})
  .middleware([queryCancellationMiddleware])
  .validator(z.object({ scenario: fixtureScenarioSchema.optional() }))
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceAccountCredentialStatus(data.scenario, context.requestSignal)
    )
  })

export const updateWorkspaceAccount = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(accountProfileUpdateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      patchWorkspaceAccount(data.changes, data.scenario, context.requestSignal)
    )
  })

export const checkWorkspaceUsername = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z.object({
      username: usernameSchema,
      scenario: fixtureScenarioSchema.optional(),
    })
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      checkWorkspaceUsernameExactMatch(
        data.username,
        data.scenario,
        context.requestSignal
      )
    )
  })
