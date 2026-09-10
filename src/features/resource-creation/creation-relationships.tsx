import { useId, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  AddRelationshipIcon,
  UnlinkRelationshipIcon,
} from "@/components/crucible/icons"
import { ResourceIdentity } from "@/components/crucible/resource-identity"
import { ResourceSearchCombobox } from "@/components/crucible/resource-search-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { crucibleKeys } from "@/data/crucible/query-keys"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  workspaceRelationshipChoiceDescription,
  workspaceRelationshipChoices,
  workspaceRelationshipOperation,
  workspaceRelationshipTypeLabel,
  workspaceRelationshipTypeOptions,
} from "@/data/crucible/resource-relationships"
import type {
  WorkspaceRelationship,
  WorkspaceRelationshipResourceKind,
} from "@/data/crucible/resource-relationships"
import { mutateWorkspaceResourceRelationship } from "@/data/crucible/resources.functions"
import { resourceQueryOptions } from "@/data/crucible/resources.queries"
import { unwrapHubResult } from "@/data/crucible/result"
import type {
  WorkspaceRelationshipMutationResult,
  WorkspaceRelationshipType,
  WorkspaceResourceDetail,
  WorkspaceSearchResult,
} from "@/data/crucible/workspace-source"

const relationshipTargetSchema = z.object({
  context: z.string().nullable(),
  kind: z.enum(["dataset", "sample"]),
  name: z.string(),
  projectId: z.string().nullable().optional(),
  unique_id: z.string(),
})

export const creationRelationshipDraftSchema = z.object({
  relationship: z.enum(["parent", "child", "associated"]),
  relationshipType: z
    .enum(workspaceRelationshipTypeOptions.map((option) => option.value))
    .nullable(),
  target: relationshipTargetSchema,
})

export type CreationRelationshipDraft = z.infer<
  typeof creationRelationshipDraftSchema
>

export function CreationRelationshipsField({
  disabled = false,
  onChange,
  resourceKind,
  scope,
  value,
}: {
  disabled?: boolean
  onChange: (value: CreationRelationshipDraft[]) => void
  resourceKind: WorkspaceRelationshipResourceKind
  scope: IdentityScope
  value: CreationRelationshipDraft[]
}) {
  const inputId = useId()
  const relationshipId = useId()
  const relationshipTypeId = useId()
  const [open, setOpen] = useState(false)
  const [choiceIndex, setChoiceIndex] = useState(0)
  const [relationshipType, setRelationshipType] =
    useState<WorkspaceRelationshipType | null>(null)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<WorkspaceSearchResult>()
  const choices = workspaceRelationshipChoices[resourceKind]
  const choice = choices[choiceIndex] ?? choices[0]

  function reset() {
    setChoiceIndex(0)
    setRelationshipType(null)
    setQuery("")
    setSelected(undefined)
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) reset()
  }

  function addRelationship() {
    if (!selected) return
    const target = relationshipTargetSchema.safeParse(selected)
    if (!target.success) return
    onChange([
      ...value,
      {
        relationship: choice.relationship,
        relationshipType:
          choice.relationship === "associated" ? null : relationshipType,
        target: target.data,
      },
    ])
    changeOpen(false)
  }

  return (
    <>
      {value.length ? (
        <ul aria-label="Relationships to add" className="flex flex-col gap-2">
          {value.map((draft) => (
            <li
              className="flex min-w-0 flex-col gap-3 rounded-lg border p-3 sm:flex-row"
              key={draft.target.unique_id}
            >
              <ResourceIdentity
                className="flex-1"
                context={draft.target.context}
                kind={draft.target.kind}
                mfid={draft.target.unique_id}
                name={draft.target.name}
                projectId={draft.target.projectId}
              />
              <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
                <Badge variant="outline">
                  {relationshipLabel(resourceKind, draft.relationship)}
                </Badge>
                {draft.relationshipType ? (
                  <Badge variant="secondary">
                    {workspaceRelationshipTypeLabel({
                      relationship: draft.relationship,
                      relationship_type: draft.relationshipType,
                    })}
                  </Badge>
                ) : null}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label={`Remove relationship with ${draft.target.name}`}
                        disabled={disabled}
                        onClick={() =>
                          onChange(
                            value.filter(
                              (candidate) =>
                                candidate.target.unique_id !==
                                draft.target.unique_id
                            )
                          )
                        }
                        size="icon-sm"
                        type="button"
                        variant="outline"
                      />
                    }
                  >
                    <UnlinkRelationshipIcon aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Remove relationship</TooltipContent>
                </Tooltip>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        className="w-full"
        disabled={disabled || value.length >= 10}
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <AddRelationshipIcon aria-hidden="true" data-icon="inline-start" />
        Add relationship
      </Button>
      <Dialog onOpenChange={changeOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add relationship</DialogTitle>
            <DialogDescription>
              Select the relationship and the resource to connect after
              creation.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={relationshipId}>Relationship</FieldLabel>
              <NativeSelect
                id={relationshipId}
                onChange={(event) => {
                  setChoiceIndex(Number(event.target.value))
                  setRelationshipType(null)
                  setQuery("")
                  setSelected(undefined)
                }}
                value={String(choiceIndex)}
              >
                {choices.map((candidate, index) => (
                  <NativeSelectOption
                    key={candidate.label}
                    value={String(index)}
                  >
                    {candidate.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                {workspaceRelationshipChoiceDescription(resourceKind, choice)}
              </FieldDescription>
            </Field>
            {choice.relationship === "associated" ? null : (
              <Field>
                <FieldLabel htmlFor={relationshipTypeId}>
                  Relationship type
                </FieldLabel>
                <NativeSelect
                  id={relationshipTypeId}
                  onChange={(event) => {
                    const nextType = workspaceRelationshipTypeOptions.find(
                      (option) => option.value === event.target.value
                    )?.value
                    setRelationshipType(nextType ?? null)
                  }}
                  value={relationshipType ?? ""}
                >
                  <NativeSelectOption value="">Unspecified</NativeSelectOption>
                  {workspaceRelationshipTypeOptions.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <ResourceSearchCombobox
              excludedIds={value.map((draft) => draft.target.unique_id)}
              id={inputId}
              kind={choice.targetKind}
              onQueryChange={setQuery}
              onValueChange={setSelected}
              query={query}
              scope={scope}
              value={selected}
            />
          </FieldGroup>
          <DialogFooter>
            <Button
              onClick={() => changeOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!selected}
              onClick={addRelationship}
              type="button"
            >
              Add relationship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function useCreationRelationshipSubmission({
  onApplied,
  resourceKind,
  scope,
}: {
  onApplied: (resource: WorkspaceResourceDetail) => void
  resourceKind: WorkspaceRelationshipResourceKind
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const completed = useRef(new Set<string>())
  const [failures, setFailures] = useState<CreationRelationshipDraft[]>([])
  const mutation = useMutation({
    mutationFn: async ({
      draft,
      resourceMfid,
    }: {
      draft: CreationRelationshipDraft
      resourceMfid: string
    }) =>
      unwrapHubResult(
        await mutateWorkspaceResourceRelationship({
          data: workspaceRelationshipOperation({
            action: "link",
            relationship: draft.relationship,
            relationshipType: draft.relationshipType,
            resourceKind,
            resourceMfid,
            scenario: fixtureScenarioFromScope(scope),
            targetMfid: draft.target.unique_id,
          }),
        })
      ),
  })

  async function apply(
    resourceMfid: string,
    drafts: readonly CreationRelationshipDraft[]
  ) {
    const nextFailures: CreationRelationshipDraft[] = []
    for (const draft of drafts) {
      if (completed.current.has(draft.target.unique_id)) continue
      try {
        const result = await mutation.mutateAsync({ draft, resourceMfid })
        completed.current.add(draft.target.unique_id)
        cacheRelationshipResult(queryClient, scope, result)
        onApplied(result.source)
      } catch {
        nextFailures.push(draft)
      }
    }
    setFailures(nextFailures)
    return nextFailures.length === 0
  }

  return {
    apply,
    failures,
    isPending: mutation.isPending,
  }
}

function cacheRelationshipResult(
  queryClient: QueryClient,
  scope: IdentityScope,
  result: WorkspaceRelationshipMutationResult
) {
  for (const resource of [result.source, result.target]) {
    queryClient.setQueryData(
      resourceQueryOptions(scope, resource.unique_id).queryKey,
      resource
    )
    void queryClient.invalidateQueries({
      queryKey: crucibleKeys.resourceGraph(scope, resource.unique_id),
    })
  }
  void queryClient.invalidateQueries({
    queryKey: crucibleKeys.sampleLists(scope),
  })
  void queryClient.invalidateQueries({
    queryKey: crucibleKeys.datasetLists(scope),
  })
  void queryClient.invalidateQueries({ queryKey: crucibleKeys.searches(scope) })
}

function relationshipLabel(
  resourceKind: WorkspaceRelationshipResourceKind,
  relationship: WorkspaceRelationship
) {
  return workspaceRelationshipChoices[resourceKind].find(
    (choice) => choice.relationship === relationship
  )?.label
}
