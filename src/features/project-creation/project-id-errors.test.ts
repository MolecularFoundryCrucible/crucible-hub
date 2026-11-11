import { describe, expect, it } from "vitest"

import { HubApiClientError } from "@/data/crucible/result"

import { reservedProjectIdMessage } from "./project-id-errors"

function apiError(
  conflictCode?: "project_id_reserved" | "lead_must_be_caller"
) {
  return new HubApiClientError({
    conflictCode,
    correlationId: "c-1",
    kind: "forbidden",
    message: "You do not have permission to perform this action.",
    retryable: false,
  })
}

describe("reservedProjectIdMessage", () => {
  it("explains a reserved project ID", () => {
    expect(reservedProjectIdMessage(apiError("project_id_reserved"))).toBe(
      "This project ID is reserved on this server. Only an administrator in Administrator view can use it."
    )
  })

  it("leaves other errors alone", () => {
    expect(reservedProjectIdMessage(apiError("lead_must_be_caller"))).toBe(
      undefined
    )
    expect(reservedProjectIdMessage(new Error("offline"))).toBe(undefined)
  })
})
