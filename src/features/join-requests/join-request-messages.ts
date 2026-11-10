import { HubApiClientError, hubErrorMessage } from "@/data/crucible/result"

const messages: Partial<Record<string, string>> = {
  already_member: "You're already a member of this project.",
  join_request_closed: "This request was already answered or withdrawn.",
  join_request_pending:
    "You already asked to join this project. Wait for a reply or withdraw that request.",
  pending_deletion:
    "This project has a deletion request, so its members can't change.",
  project_not_accepting_requests:
    "This project isn't accepting requests to join.",
  project_not_found: "This project no longer exists.",
  service_account_cannot_request:
    "Service accounts can't ask to join projects.",
  too_many_pending_requests:
    "You have 20 requests waiting. Withdraw one before asking to join another project.",
}

export function joinRequestError(error: unknown, fallback: string) {
  const code =
    error instanceof HubApiClientError ? error.details.conflictCode : undefined
  return (code && messages[code]) ?? hubErrorMessage(error, fallback)
}

export function isProjectMember(
  project: {
    lead?: { unique_id: string } | null
    members?: readonly { unique_id: string }[] | null
    project_lead_orcid?: string | null
    role?: string | null
  },
  accountId: string
) {
  return (
    Boolean(project.role) ||
    project.lead?.unique_id === accountId ||
    project.project_lead_orcid === accountId ||
    project.members?.some((member) => member.unique_id === accountId) === true
  )
}
