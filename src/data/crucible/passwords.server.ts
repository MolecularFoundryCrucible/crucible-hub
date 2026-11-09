import "@tanstack/react-start/server-only"

import { requireAdministratorView } from "@/server/crucible/privilege-mode.server"
import { CrucibleResponseError } from "@/server/crucible/request-error.server"

import { createCrucibleClient } from "../../server/crucible/client.server"
import { crucibleRequestSignal } from "../../server/crucible/request-signal.server"
import type { FixtureScenario } from "./fixture-scenarios"
import { readWorkspaceConfiguration } from "./workspace-config.server"
import { readWorkspaceFixture } from "./workspace-fixture.server"
import type { WorkspacePasswordLink } from "./workspace-source"

export type PasswordOwner = { kind: "self" } | { kind: "user"; userId: string }

function apiConfiguration() {
  const configuration = readWorkspaceConfiguration()
  if (configuration.mode === "unavailable") {
    throw new Error(configuration.reason)
  }
  return configuration
}

function ownerClient(
  configuration: Exclude<
    ReturnType<typeof readWorkspaceConfiguration>,
    { mode: "unavailable" | "fixture" }
  >,
  owner: PasswordOwner
) {
  return owner.kind === "self"
    ? createCrucibleClient(configuration)
    : createCrucibleClient(configuration, {
        privilegeMode: requireAdministratorView(),
      })
}

export async function setWorkspaceAccountPassword(
  input: { currentPassword?: string; newPassword: string },
  requestSignal?: AbortSignal
): Promise<void> {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") return
  const result = await createCrucibleClient(configuration).POST(
    "/account/password",
    {
      body: {
        new_password: input.newPassword,
        ...(input.currentPassword
          ? { current_password: input.currentPassword }
          : {}),
      },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}

export async function issueWorkspaceUserPasswordLink(
  userId: string,
  scenario?: FixtureScenario,
  requestSignal?: AbortSignal
): Promise<WorkspacePasswordLink> {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") {
    const source = readWorkspaceFixture(scenario)
    if (source.status === "unavailable") throw new Error(source.reason)
    return {
      expires_at: new Date(
        Date.parse(source.workspace.referenceTime) + 24 * 60 * 60 * 1000
      ).toISOString(),
      purpose: "setup",
      url: "https://crucible.example.test/api/v3/oauth/password-link#fixture",
    }
  }
  const result = await ownerClient(configuration, {
    kind: "user",
    userId,
  }).POST("/users/{user_ref}/password-link", {
    params: { path: { user_ref: userId } },
    signal: crucibleRequestSignal(requestSignal),
  })
  if (!result.data) {
    throw new CrucibleResponseError(result.response, result.error)
  }
  return {
    expires_at: result.data.expires_at,
    purpose: result.data.purpose === "reset" ? "reset" : "setup",
    url: result.data.url,
  }
}

export async function removeWorkspaceUserPassword(
  owner: PasswordOwner & { userId: string },
  requestSignal?: AbortSignal
): Promise<void> {
  const configuration = apiConfiguration()
  if (configuration.mode === "fixture") return
  const result = await ownerClient(configuration, owner).DELETE(
    "/users/{user_ref}/password",
    {
      params: { path: { user_ref: owner.userId } },
      signal: crucibleRequestSignal(requestSignal),
    }
  )
  if (!result.response.ok) {
    throw new CrucibleResponseError(result.response, result.error)
  }
}
