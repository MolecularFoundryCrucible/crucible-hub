import { HubApiClientError } from "@/data/crucible/result"

const uncertainErrorKinds = new Set([
  "cancelled",
  "timeout",
  "unexpected",
  "upstream",
])

export function isUncertainCreationError(error: unknown) {
  return (
    !(error instanceof HubApiClientError) ||
    uncertainErrorKinds.has(error.details.kind)
  )
}

export function creationFailureMessage(
  resourceKind: "dataset" | "sample",
  error: unknown
) {
  if (isUncertainCreationError(error)) {
    return `Crucible may have created this ${resourceKind}, but Hub could not confirm it. Check Data before submitting again. Your entries are still here.`
  }
  if (error instanceof HubApiClientError) return error.message
  return `The ${resourceKind} could not be created. Your entries are still here.`
}
