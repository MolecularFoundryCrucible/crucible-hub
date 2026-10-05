import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"
import { usernameSchema } from "./slugs"
import {
  addUserToAccessGroup,
  createWorkspaceUser,
  patchWorkspaceUser,
  provisionWorkspaceUserApiKey,
  readWorkspaceUserAccessGroups,
  readWorkspaceUserApiKeyStatus,
  readWorkspaceUserDetail,
  readWorkspaceUserProjects,
  readWorkspaceUsers,
  removeUserFromAccessGroup,
} from "./users.server"

const userIdSchema = z.string().trim().min(1).max(255)
const profileNameSchema = z.string().trim().max(255).nullable()
const profileEmailSchema = z.string().trim().email().max(320).nullable()
const profileUsernameSchema = usernameSchema.nullable()

export const userListInputSchema = z
  .object({
    is_service_account: z.boolean().optional(),
    limit: z.number().int().min(1).max(1000),
    offset: z.number().int().min(0),
    query: z.string().trim().min(1).max(200).optional(),
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const userDetailInputSchema = z
  .object({
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

export const userGroupActionInputSchema = z
  .object({
    groupName: z.string().trim().min(1).max(255),
    scenario: fixtureScenarioSchema.optional(),
    userId: userIdSchema,
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

export const getWorkspaceUserApiKeyStatus = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(userDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceUserApiKeyStatus(
        data.userId,
        data.scenario,
        context.requestSignal
      )
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

export const getWorkspaceUserAccessGroups = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(userDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceUserAccessGroups(
        data.userId,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const addUserToAccessGroupFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(userGroupActionInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      addUserToAccessGroup(
        data.userId,
        data.groupName,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const removeUserFromAccessGroupFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(userGroupActionInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      removeUserFromAccessGroup(
        data.userId,
        data.groupName,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const getWorkspaceUserProjects = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(userDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceUserProjects(
        data.userId,
        data.scenario,
        context.requestSignal
      )
    )
  })
