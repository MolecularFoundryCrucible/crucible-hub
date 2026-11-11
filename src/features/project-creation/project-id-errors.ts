import { HubApiClientError } from "@/data/crucible/result"

export function reservedProjectIdMessage(error: unknown) {
  return error instanceof HubApiClientError &&
    error.details.conflictCode === "project_id_reserved"
    ? "This project ID is reserved on this server. Only an administrator in Administrator view can use it."
    : undefined
}
