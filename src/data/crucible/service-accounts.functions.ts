import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { usernameSchema } from "./slugs"
import { userActivityFilters } from "./user-activity"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import {
  createWorkspaceServiceAccount as createWorkspaceServiceAccountServer,
  patchWorkspaceServiceAccount,
  patchWorkspaceServiceAccountPlatformRole,
  readWorkspaceServiceAccount,
  readWorkspaceServiceAccounts,
  rotateWorkspaceServiceAccountKey as rotateWorkspaceServiceAccountKeyServer,
} from "./service-accounts.server"

const serviceAccountMfidSchema = z.string().trim().min(1).max(255)
export const serviceAccountPlatformRoleSchema = z.enum([
  "none",
  "contributor",
  "admin",
])
const optionalProfileTextSchema = z.string().trim().max(255).nullable()

export const serviceAccountListInputSchema = z
  .object({
    activity: z.enum(userActivityFilters).optional(),
    cursor: z.string().trim().min(1).max(2048).optional(),
    direction: z.enum(["asc", "desc"]).optional(),
    includeTotal: z.boolean().optional(),
    limit: z.number().int().min(1).max(1000),
    query: z.string().trim().min(1).max(200).optional(),
    scenario: fixtureScenarioSchema.optional(),
    sort: z.enum(["username", "unique_id", "last_active"]).optional(),
  })
  .strict()

export const serviceAccountDetailInputSchema = z
  .object({
    scenario: fixtureScenarioSchema.optional(),
    serviceAccountMfid: serviceAccountMfidSchema,
  })
  .strict()

export const serviceAccountCreateInputSchema = z
  .object({
    scenario: fixtureScenarioSchema.optional(),
    unique_id: z.string().trim().length(26).optional(),
    username: usernameSchema,
  })
  .strict()

export const serviceAccountUpdateInputSchema = z
  .object({
    changes: z
      .object({
        first_name: optionalProfileTextSchema.optional(),
        last_name: optionalProfileTextSchema.optional(),
        username: usernameSchema.optional(),
      })
      .strict()
      .refine(
        (changes) => Object.keys(changes).length > 0,
        "At least one profile change is required."
      ),
    scenario: fixtureScenarioSchema.optional(),
    serviceAccountMfid: serviceAccountMfidSchema,
  })
  .strict()

export const serviceAccountRoleUpdateInputSchema = z
  .object({
    platformRole: serviceAccountPlatformRoleSchema,
    scenario: fixtureScenarioSchema.optional(),
    serviceAccountMfid: serviceAccountMfidSchema,
  })
  .strict()

export const getWorkspaceServiceAccounts = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(serviceAccountListInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceServiceAccounts(data, context.requestSignal)
    )
  })

export const getWorkspaceServiceAccountAdmin = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(serviceAccountDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceServiceAccount(
        data.serviceAccountMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const createWorkspaceServiceAccount = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(serviceAccountCreateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      createWorkspaceServiceAccountServer(
        { unique_id: data.unique_id, username: data.username },
        data.scenario,
        context.requestSignal
      )
    )
  })

export const updateWorkspaceServiceAccount = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(serviceAccountUpdateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      patchWorkspaceServiceAccount(
        data.serviceAccountMfid,
        data.changes,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const updateWorkspaceServiceAccountPlatformRole = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(serviceAccountRoleUpdateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      patchWorkspaceServiceAccountPlatformRole(
        data.serviceAccountMfid,
        data.platformRole,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const rotateWorkspaceServiceAccountKey = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(serviceAccountDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      rotateWorkspaceServiceAccountKeyServer(
        data.serviceAccountMfid,
        data.scenario,
        context.requestSignal
      )
    )
  })
