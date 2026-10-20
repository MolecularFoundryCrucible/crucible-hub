import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import type { IdentityScope } from "@/data/crucible/query-keys"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { updateWorkspaceResourceMetadata } from "@/data/crucible/resources.functions"
import { unwrapHubResult } from "@/data/crucible/result"
import type { WorkspaceScientificMetadata } from "@/data/crucible/workspace-source"
import {
  MetadataInput,
  emptyMetadataDraft,
  metadataDraftResult,
  metadataDraftSchema,
} from "@/features/resource-metadata/metadata-input"
import type { MetadataDraft } from "@/features/resource-metadata/metadata-input"
import { mergeScientificMetadataUpdate } from "@/features/resource-metadata/scientific-metadata-form"

export { metadataFieldValue } from "@/features/resource-metadata/metadata-input"

export type CreationMetadataDraft = MetadataDraft

export const emptyCreationMetadata = emptyMetadataDraft
export const creationMetadataResult = metadataDraftResult
export const creationMetadataSchema = metadataDraftSchema

export function CreationMetadataCard({
  busy,
  disabled,
  errors,
  onChange,
  value,
}: {
  busy: boolean
  disabled: boolean
  errors: React.ComponentProps<typeof FieldError>["errors"]
  onChange: (value: CreationMetadataDraft) => void
  value: CreationMetadataDraft
}) {
  return (
    <Card aria-busy={busy}>
      <CardHeader>
        <CardTitle>Scientific metadata</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <MetadataInput disabled={disabled} onChange={onChange} value={value} />
        <FieldError errors={errors} />
      </CardContent>
    </Card>
  )
}

export function useCreationMetadataSubmission({
  resourceKind,
  scope,
}: {
  resourceKind: "dataset" | "sample"
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const completed = useRef(false)
  const [failed, setFailed] = useState(false)
  const mutation = useMutation({
    mutationFn: async ({
      metadata,
      resourceMfid,
    }: {
      metadata: WorkspaceScientificMetadata
      resourceMfid: string
    }) =>
      unwrapHubResult(
        await updateWorkspaceResourceMetadata({
          data: {
            resourceKind,
            resourceMfid,
            scenario: fixtureScenarioFromScope(scope),
            update: { kind: "replace", metadata },
          },
        })
      ),
  })

  async function apply(resourceMfid: string, draft: CreationMetadataDraft) {
    const result = creationMetadataResult(draft)
    if (completed.current || !result.ok || !result.metadata) {
      setFailed(false)
      return true
    }
    try {
      const saved = await mutation.mutateAsync({
        metadata: result.metadata,
        resourceMfid,
      })
      completed.current = true
      queryClient.setQueryData(
        resourceQueryOptions(scope, resourceMfid).queryKey,
        (current) =>
          mergeScientificMetadataUpdate(current, saved.scientific_metadata)
      )
      setFailed(false)
      return true
    } catch {
      setFailed(true)
      return false
    }
  }

  return { apply, failed, isPending: mutation.isPending }
}
