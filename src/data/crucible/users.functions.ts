import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { userActivityFilters } from "./user-activity"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import { usernameSchema } from "./slugs"
import {
  checkWorkspaceEmailExactMatch,
  createWorkspaceUser,
  patchWorkspaceUser,
  provisionWorkspaceUserApiKey,
  readWorkspaceUserDetail,
  readWorkspaceUsers,
  revokeWorkspaceUserApiKey,
  updateWorkspaceUserPlatformRole,
} from "./users.server"

const userIdSchema = z.string().trim().min(1).max(255)
const profileNameSchema = z.string().trim().min(1).max(255)
const profileEmailSchema = z.string().trim().email().max(320).nullable()
const profileUsernameSchema = usernameSchema.nullable()

export const userListInputSchema = z
  .object({
    cursor: z.string().trim().min(1).max(2048).optional(),
    direction: z.enum(["asc", "desc"]).optional(),
    includeTotal: z.boolean().optional(),
    is_service_account: z.boolean().optional(),
    limit: z.number().int().min(1).max(1000),
    query: z.string().trim().min(1).max(200).optional(),
    scenario: fixtureScenarioSchema.optional(),
    activity: z.enum(userActivityFilters).optional(),
    sort: z
      .enum(["name", "unique_id", "email", "username", "last_active"])
      .optional(),
  })
  .strict()

export const userDetailInputSchema = z
  .object({
    scenario: fixtureScenarioSchema.optional(),
    userId: userIdSchema,
  })
  .strict()

export const userPlatformRoleInputSchema = z
  .object({
    platformRole: z.enum(["none", "contributor", "admin"]),
    scenario: fixtureScenarioSchema.optional(),
    userId: userIdSchema,
  })
  .strict()

export const userUpdateInputSchema = z
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
    userId: userIdSchema,
  })
  .strict()

export const userCreateInputSchema = z
  .object({
    email: profileEmailSchema.optional(),
    first_name: z.string().trim().min(1, "Enter a first name.").max(255),
    last_name: z.string().trim().min(1, "Enter a last name.").max(255),
    project_ids: z.array(z.string().trim().min(1)).optional(),
    scenario: fixtureScenarioSchema.optional(),
    unique_id: z.string().trim().max(255).optional(),
    username: usernameSchema,
  })
  .strict()

export const getWorkspaceUsers = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(userListInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceUsers(data, context.requestSignal)
    )
  })

export const getWorkspaceUserDetail = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(userDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceUserDetail(data.userId, data.scenario, context.requestSignal)
    )
  })

export const updateWorkspaceUser = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(userUpdateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      patchWorkspaceUser(
        data.userId,
        data.changes,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const createWorkspaceUserFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(userCreateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      createWorkspaceUser(data, data.scenario, context.requestSignal)
    )
  })

export const provisionWorkspaceUserApiKeyFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(userDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      provisionWorkspaceUserApiKey(
        data.userId,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const updateWorkspaceUserPlatformRoleFn = createServerFn({
  method: "POST",
})
  .middleware([queryCancellationMiddleware])
  .validator(userPlatformRoleInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      updateWorkspaceUserPlatformRole(
        data.userId,
        data.platformRole,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const revokeWorkspaceUserApiKeyFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(userDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      revokeWorkspaceUserApiKey(
        data.userId,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const checkWorkspaceEmail = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z.object({
      email: z.string().trim().email(),
      scenario: fixtureScenarioSchema.optional(),
    })
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      checkWorkspaceEmailExactMatch(
        data.email,
        data.scenario,
        context.requestSignal
      )
    )
  })
