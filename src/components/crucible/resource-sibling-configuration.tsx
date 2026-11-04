import { useId, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import {
  CompactLabelTooltip,
  compactLabelProps,
} from "@/components/crucible/compact-label-tooltip"
import { createAnchoredResourceSiblingCollection } from "@/components/crucible/anchored-resource-siblings"
import { CollectionOrderFields } from "@/components/crucible/collection-query-fields"
import { ResourceSequenceIcon } from "@/components/crucible/icons"
import type {
  ActiveResourceSiblingNavigation,
  ResourceSiblingConfiguration,
} from "@/components/crucible/resource-sibling-navigation"
import {
  useActivateResourceSiblingCollection,
  useClearResourceSiblingNavigation,
} from "@/components/crucible/resource-sibling-navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { IdentityScope } from "@/data/crucible/query-keys"
import {
  isDefaultResourceSequence,
  resolveResourceSequence,
  resourceSequenceAffiliation,
  resourceSequencePreferenceKey,
} from "@/data/crucible/resource-sequence"
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { useAccountPreferences } from "@/features/preferences/use-account-preferences"

type Resource = Extract<WorkspaceResourceDetail, { kind: "dataset" | "sample" }>

export function ResourceSiblingConfigurationAction({
  navigation,
  pending: sequencePending = false,
  resource,
  scope,
}: {
  navigation: ActiveResourceSiblingNavigation | null
  pending?: boolean
  resource: Resource
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const activate = useActivateResourceSiblingCollection()
  const clear = useClearResourceSiblingNavigation()
  const [open, setOpen] = useState(false)
  const { enabled, preferences, update } = useAccountPreferences()
  const preferenceKey = resourceSequencePreferenceKey(resource.kind)
  const saved = preferences.hub?.resource_sequence?.[preferenceKey]
  const savedConfiguration = () =>
    resolveResourceSequence(
      saved?.scope === "off" ? undefined : saved,
      resource
    )
  const saveDefaultId = useId()
  const [saveDefault, setSaveDefault] = useState(false)
  const [configuration, setConfiguration] = useState(savedConfiguration)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setConfiguration(navigation?.configuration ?? savedConfiguration())
      setSaveDefault(false)
      setError(false)
    }
  }

  async function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activate || pending) return
    setPending(true)
    setError(false)
    try {
      const collection = await createAnchoredResourceSiblingCollection({
        affiliation: resourceSequenceAffiliation({
          includePublic: preferences.hub?.include_public_data === true,
          resource,
          scope,
        }),
        configuration,
        queryClient,
        resource,
        scope,
      })
      activate(collection)
      if (saveDefault) {
        update({
          hub: {
            resource_sequence: {
              [preferenceKey]: isDefaultResourceSequence(configuration)
                ? null
                : configuration,
            },
          },
        })
      }
      setOpen(false)
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  const title = navigation?.label ?? "Browse nearby"

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <CompactLabelTooltip label={title}>
        <DialogTrigger
          render={
            <Button
              aria-label={`Change resource sequence. ${title}`}
              className="max-w-resource-sequence min-w-0"
              type="button"
              variant={navigation || sequencePending ? "outline" : "ghost"}
            />
          }
        >
          <ResourceSequenceIcon aria-hidden="true" data-icon="inline-start" />
          <span
            className="truncate @max-labels/content:sr-only"
            {...compactLabelProps}
          >
            {title}
          </span>
        </DialogTrigger>
      </CompactLabelTooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Browse nearby {resource.kind === "dataset" ? "datasets" : "samples"}
          </DialogTitle>
        </DialogHeader>
        <form id="resource-sibling-configuration" onSubmit={apply}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="resource-sibling-scope">Include</FieldLabel>
              <NativeSelect
                className="w-full"
                id="resource-sibling-scope"
                onChange={(event) => {
                  const nextScope = resourceSiblingScope(event.target.value)
                  if (nextScope) {
                    setConfiguration((current) => ({
                      ...current,
                      scope: nextScope,
                    }))
                  }
                }}
                value={configuration.scope}
              >
                <NativeSelectOption value="all">
                  All readable{" "}
                  {resource.kind === "dataset" ? "datasets" : "samples"}
                </NativeSelectOption>
                {resource.project ? (
                  <NativeSelectOption value="project_subtype">
                    Same project and{" "}
                    {resource.kind === "dataset"
                      ? "measurement"
                      : "sample type"}
                  </NativeSelectOption>
                ) : null}
                {resource.project ? (
                  <NativeSelectOption value="project">
                    Same project
                  </NativeSelectOption>
                ) : null}
                <NativeSelectOption value="subtype">
                  Same{" "}
                  {resource.kind === "dataset" ? "measurement" : "sample type"}
                </NativeSelectOption>
                {resource.owner ? (
                  <NativeSelectOption value="owner">
                    Same owner
                  </NativeSelectOption>
                ) : null}
                {resource.kind === "dataset" ? (
                  <NativeSelectOption value="instrument">
                    Same instrument
                  </NativeSelectOption>
                ) : null}
              </NativeSelect>
            </Field>
            <CollectionOrderFields
              allowDefault={false}
              idPrefix="resource-sibling"
              onChange={(value) =>
                setConfiguration((current) => ({
                  ...current,
                  direction: value.direction === "asc" ? "asc" : "desc",
                  sort:
                    value.sort === "created" || value.sort === "updated"
                      ? value.sort
                      : "name",
                }))
              }
              value={configuration}
            />
            {enabled ? (
              <Field orientation="horizontal">
                <Checkbox
                  checked={saveDefault}
                  id={saveDefaultId}
                  onCheckedChange={setSaveDefault}
                />
                <FieldLabel htmlFor={saveDefaultId}>
                  Save as my default
                </FieldLabel>
              </Field>
            ) : null}
          </FieldGroup>
          {error ? (
            <FieldError
              errors={[
                { message: "The resource sequence could not be loaded." },
              ]}
              role="alert"
            />
          ) : null}
        </form>
        <DialogFooter>
          {navigation ? (
            <Button
              className="sm:mr-auto"
              disabled={pending}
              onClick={() => {
                clear?.(resource.unique_id)
                setOpen(false)
              }}
              type="button"
              variant="ghost"
            >
              Clear sequence
            </Button>
          ) : null}
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending}
            form="resource-sibling-configuration"
            type="submit"
          >
            {pending ? <PendingIcon data-icon="inline-start" /> : null}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function resourceSiblingScope(
  value: string
): ResourceSiblingConfiguration["scope"] | undefined {
  return value === "all" ||
    value === "instrument" ||
    value === "owner" ||
    value === "project" ||
    value === "project_subtype" ||
    value === "subtype"
    ? value
    : undefined
}
