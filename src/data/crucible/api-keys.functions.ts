import { createServerFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"
import { z } from "zod"

import { safeCrucibleCall } from "@/server/crucible/safe-call.server"

import {
  createWorkspaceApiKey,
  readWorkspaceApiKeys,
  renameWorkspaceApiKey,
  revokeWorkspaceApiKey,
} from "./api-keys.server"
import { fixtureScenarioSchema } from "./fixture-scenarios"
import { queryCancellationMiddleware } from "./query-cancellation"

const userIdSchema = z.string().trim().min(1).max(255)
const keyIdSchema = z.number().int().positive()
const keyNameSchema = z.string().trim().min(1).max(100)

export const getWorkspaceApiKeys = createServerFn({ method: "GET" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        cursor: z.string().min(1).max(4096).optional(),
        limit: z.number().int().min(1).max(200),
        scenario: fixtureScenarioSchema.optional(),
        state: z.enum(["active", "inactive"]),
        userId: userIdSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      readWorkspaceApiKeys(
        data.userId ? { kind: "user", userId: data.userId } : { kind: "self" },
        { cursor: data.cursor, limit: data.limit, state: data.state },
        data.scenario,
        context.requestSignal
      )
    )
  })

export const createWorkspaceApiKeyFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        expiresAt: z.string().datetime().nullable(),
        name: keyNameSchema,
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      createWorkspaceApiKey(
        { expiresAt: data.expiresAt, name: data.name },
        data.scenario,
        context.requestSignal
      )
    )
  })

export const renameWorkspaceApiKeyFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z
      .object({
        keyId: keyIdSchema,
        name: keyNameSchema,
        scenario: fixtureScenarioSchema.optional(),
      })
      .strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      renameWorkspaceApiKey(
        data.keyId,
        data.name,
        data.scenario,
        context.requestSignal
      )
    )
  })

export const revokeWorkspaceApiKeyFn = createServerFn({ method: "POST" })
  .middleware([queryCancellationMiddleware])
  .validator(
    z.object({ keyId: keyIdSchema, userId: userIdSchema.optional() }).strict()
  )
  .handler(async ({ context, data }) => {
    setResponseHeader("Cache-Control", "no-store")
    return safeCrucibleCall(context.correlationId, () =>
      revokeWorkspaceApiKey(
        data.userId ? { kind: "user", userId: data.userId } : { kind: "self" },
        data.keyId,
        context.requestSignal
      )
    )
  })
