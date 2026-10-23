import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { createAnchoredResourceSiblingCollection } from "@/components/crucible/anchored-resource-siblings"
import { CollectionOrderFields } from "@/components/crucible/collection-query-fields"
import { FilterIcon } from "@/components/crucible/icons"
import type {
  ActiveResourceSiblingNavigation,
  ResourceSiblingConfiguration,
} from "@/components/crucible/resource-sibling-navigation"
import {
  useActivateResourceSiblingCollection,
  useClearResourceSiblingNavigation,
} from "@/components/crucible/resource-sibling-navigation"
import { Button } from "@/components/ui/button"
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
import type { WorkspaceResourceDetail } from "@/data/crucible/workspace-source"
import { PendingIcon } from "@/components/crucible/pending-icon"

type Resource = Extract<WorkspaceResourceDetail, { kind: "dataset" | "sample" }>

export function ResourceSiblingConfigurationAction({
  navigation,
  resource,
  scope,
}: {
  navigation: ActiveResourceSiblingNavigation | null
  resource: Resource
  scope: IdentityScope
}) {
  const queryClient = useQueryClient()
  const activate = useActivateResourceSiblingCollection()
  const clear = useClearResourceSiblingNavigation()
  const [open, setOpen] = useState(false)
  const [configuration, setConfiguration] = useState(defaultConfiguration)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setConfiguration(navigation?.configuration ?? defaultConfiguration())
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
        configuration,
        queryClient,
        resource,
        scope,
      })
      activate(collection)
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
      <DialogTrigger
        render={
          <Button
            aria-label={`Change resource sequence. ${title}`}
            className="max-w-resource-sequence min-w-0"
            type="button"
            variant={navigation ? "outline" : "ghost"}
          />
        }
      >
        <FilterIcon aria-hidden="true" data-icon="inline-start" />
        <span className="hidden truncate sm:inline">{title}</span>
      </DialogTrigger>
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
                clear?.()
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

function defaultConfiguration(): ResourceSiblingConfiguration {
  return {
    direction: "asc",
    scope: "subtype",
    sort: "name",
  }
}

function resourceSiblingScope(
  value: string
): ResourceSiblingConfiguration["scope"] | undefined {
  return value === "all" ||
    value === "instrument" ||
    value === "owner" ||
    value === "project" ||
    value === "subtype"
    ? value
    : undefined
}
