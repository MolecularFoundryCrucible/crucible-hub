import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { notifySuccess } from "@/components/crucible/notifications"
import { DelayedPendingIcon } from "@/components/crucible/pending-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import {
  createJoinRequestFn,
  withdrawJoinRequestFn,
} from "@/data/crucible/join-requests.functions"
import { joinRequestsQueryOptions } from "@/data/crucible/join-requests.queries"
import { crucibleKeys } from "@/data/crucible/query-keys"
import { unwrapHubResult } from "@/data/crucible/result"

import { joinRequestError } from "./join-request-messages"

export function RequestToJoinProject({
  projectMfid,
  projectName,
}: {
  projectMfid: string
  projectName: string
}) {
  const scope = useWorkspaceScope()
  const queryClient = useQueryClient()
  const scenario = fixtureScenarioFromScope(scope)
  const pendingResult = useQuery(
    joinRequestsQueryOptions(scope, {
      projectMfid,
      scope: "submitted",
      status: "pending",
    })
  )
  const pending = pendingResult.data?.items.at(0)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string>()
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: crucibleKeys.joinRequestQueries(scope),
    })
  const request = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await createJoinRequestFn({
          data: {
            projectRef: projectMfid,
            reason: reason.trim() || null,
            scenario,
          },
        })
      ),
    onSuccess: async () => {
      await refresh()
      setOpen(false)
      notifySuccess("Request sent")
    },
    onError: (cause) =>
      setError(joinRequestError(cause, "The request could not be sent.")),
  })
  const withdraw = useMutation({
    mutationFn: async (requestId: number) =>
      unwrapHubResult(
        await withdrawJoinRequestFn({ data: { requestId, scenario } })
      ),
    onSuccess: async () => {
      await refresh()
      notifySuccess("Request withdrawn")
    },
    onError: (cause) =>
      setError(joinRequestError(cause, "The request could not be withdrawn.")),
  })

  if (pendingResult.isPending) return null
  if (pending) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">Request pending</Badge>
        {pending.capabilities.can_withdraw ? (
          <Button
            disabled={withdraw.isPending}
            onClick={() => {
              setError(undefined)
              withdraw.mutate(pending.id)
            }}
            size="sm"
            variant="outline"
          >
            <DelayedPendingIcon
              data-icon="inline-start"
              pending={withdraw.isPending}
            />
            Withdraw
          </Button>
        ) : null}
        {error ? (
          <span className="text-supporting text-destructive" role="alert">
            {error}
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <>
      <Button
        onClick={() => {
          setReason("")
          setError(undefined)
          setOpen(true)
        }}
        variant="outline"
      >
        Request to join
      </Button>
      <ConfirmationDialog
        confirmLabel="Send request"
        description={projectName}
        error={error}
        onConfirm={() => {
          if (!request.isPending) {
            setError(undefined)
            request.mutate()
          }
        }}
        onOpenChange={(next) => {
          if (!request.isPending) setOpen(next)
        }}
        open={open}
        pending={request.isPending}
        pendingLabel="Sending request"
        title="Request to join"
      >
        <Field>
          <FieldLabel htmlFor={`join-reason-${projectMfid}`}>
            Reason <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Textarea
            id={`join-reason-${projectMfid}`}
            maxLength={2000}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            value={reason}
          />
        </Field>
      </ConfirmationDialog>
    </>
  )
}
