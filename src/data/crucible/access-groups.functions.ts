import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  createWorkspaceAccessGroup,
  readWorkspaceAccessGroup,
  readWorkspaceAccessGroups,
  readWorkspaceAccessGroupUsers,
} from "./access-groups.server"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"

const groupNameSchema = z.string().trim().min(1).max(255)

export const accessGroupDetailInputSchema = z
  .object({
    groupName: groupNameSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const accessGroupCreateInputSchema = z
  .object({
    group_name: groupNameSchema,
    scenario: fixtureScenarioSchema.optional(),
  })
  .strict()

export const getWorkspaceAccessGroups = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceAccessGroups(data.scenario, context.requestSignal)
    )
  })

export const getWorkspaceAccessGroup = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(accessGroupDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceAccessGroup(
        data.groupName,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const createWorkspaceAccessGroupFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(accessGroupCreateInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      createWorkspaceAccessGroup(
        { group_name: data.group_name },
        data.scenario,
        context.requestSignal
      )
    )
  })

export const getWorkspaceAccessGroupUsers = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(accessGroupDetailInputSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceAccessGroupUsers(
        data.groupName,
        data.scenario,
        context.requestSignal
      )
    )
  })
