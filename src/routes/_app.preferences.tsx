import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"

import { ContentBoundary } from "@/components/crucible/content-layout"
import { PageHeader } from "@/components/crucible/page-header"
import { PageLayout } from "@/components/crucible/page-layout"
import { PendingIcon } from "@/components/crucible/pending-icon"
import {
  ResourceSectionNavigation,
  ResourceSectionPanel,
  resourceSectionActiveProps,
  resourceSectionLinkClassName,
} from "@/components/crucible/resource-section-navigation"
import { SegmentedControl } from "@/components/crucible/segmented-control"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  globalDatasetBrowseOptions,
  globalSampleBrowseOptions,
} from "@/data/crucible/collection-browse"
import type { CollectionBrowseOption } from "@/data/crucible/collection-browse"
import { defaultCollectionOrdering } from "@/data/crucible/collection-query"
import type {
  ResourceSort,
  SortDirection,
} from "@/data/crucible/collection-query"
import type {
  DirectorySortField,
  ResourceSequencePreference,
} from "@/data/crucible/preferences"
import { accountPreferencesQueryOptions } from "@/data/crucible/preferences.queries"
import { printersQueryOptions } from "@/data/crucible/print.queries"
import {
  defaultResourceSequence,
  isDefaultResourceSequence,
} from "@/data/crucible/resource-sequence"
import { recentScopeOptions } from "@/features/home/home-data"
import { useThemePreference } from "@/features/preferences/theme-preference"
import { useAccountPreferences } from "@/features/preferences/use-account-preferences"
import { useClearRecentHistory } from "@/features/recently-viewed/recently-viewed"
import { ConfirmationDialog } from "@/components/crucible/confirmation-dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const themeOptions = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const

const recordKindOptions = [
  { label: "Samples", value: "samples" },
  { label: "Datasets", value: "datasets" },
] as const

const dataSortOptions = [
  { defaultDirection: "desc", label: "Created", value: "created" },
  { defaultDirection: "desc", label: "Updated", value: "updated" },
  { defaultDirection: "asc", label: "Name", value: "name" },
] as const satisfies readonly {
  defaultDirection: SortDirection
  label: string
  value: ResourceSort
}[]

const directorySortOptions = [
  { defaultDirection: "asc", label: "Name", value: "name" },
  { defaultDirection: "desc", label: "Created", value: "created" },
  { defaultDirection: "desc", label: "Updated", value: "updated" },
  { defaultDirection: "desc", label: "Last activity", value: "activity" },
] as const satisfies readonly {
  defaultDirection: SortDirection
  label: string
  value: DirectorySortField
}[]

const defaultDirectoryOrdering = {
  direction: "asc",
  sort: "name",
} as const satisfies {
  direction: SortDirection
  sort: DirectorySortField
}

const sampleSequenceOptions = [
  { label: "Same project and sample type", value: "project_subtype" },
  { label: "Same project", value: "project" },
  { label: "Same sample type", value: "subtype" },
  { label: "Same owner", value: "owner" },
  { label: "All readable samples", value: "all" },
  { label: "Off", value: "off" },
] as const

const datasetSequenceOptions = [
  { label: "Same project and measurement", value: "project_subtype" },
  { label: "Same project", value: "project" },
  { label: "Same measurement", value: "subtype" },
  { label: "Same owner", value: "owner" },
  { label: "Same instrument", value: "instrument" },
  { label: "All readable datasets", value: "all" },
  { label: "Off", value: "off" },
] as const

const preferenceTabs = [
  { label: "General", value: "general" },
  { label: "Browsing", value: "browsing" },
  { label: "History", value: "history" },
] as const

const preferencesSearchSchema = z.object({
  tab: z.enum(["browsing", "history"]).optional().catch(undefined),
})

export const Route = createFileRoute("/_app/preferences")({
  validateSearch: preferencesSearchSchema,
  head: () => ({ meta: [{ title: "Preferences | Crucible Hub" }] }),
  loader: async ({ context, parentMatchPromise }) => {
    const source = (await parentMatchPromise).loaderData
    if (source?.status !== "ready" || !source.accountPreferencesEnabled) {
      throw notFound()
    }
    await context.queryClient.ensureQueryData(
      accountPreferencesQueryOptions(source.scope)
    )
  },
  component: PreferencesPage,
})

function PreferenceField({
  children,
  description,
  id,
  title,
}: {
  children: React.ReactNode
  description?: string
  id?: string
  title: string
}) {
  return (
    <Field orientation="responsive">
      <FieldContent>
        {id ? (
          <FieldLabel htmlFor={id}>{title}</FieldLabel>
        ) : (
          <FieldTitle>{title}</FieldTitle>
        )}
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
      </FieldContent>
      <div>{children}</div>
    </Field>
  )
}

function GroupingSelect<TField extends string>({
  id,
  onChange,
  options,
  value,
}: {
  id: string
  onChange: (value: TField | null) => void
  options: readonly CollectionBrowseOption<TField>[]
  value: TField | undefined
}) {
  return (
    <NativeSelect
      id={id}
      onChange={(event) =>
        onChange(
          options.find((option) => option.value === event.target.value)
            ?.value ?? null
        )
      }
      value={value ?? ""}
    >
      <NativeSelectOption value="">None (flat list)</NativeSelectOption>
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

function DefaultSortSelect<TSort extends string>({
  defaultOrdering,
  idPrefix,
  label,
  onChange,
  options,
  value,
}: {
  defaultOrdering: { direction: SortDirection; sort: TSort }
  idPrefix: string
  label: string
  onChange: (value: { direction: SortDirection; sort: TSort } | null) => void
  options: readonly {
    defaultDirection: SortDirection
    label: string
    value: TSort
  }[]
  value: { direction: SortDirection; sort: TSort } | undefined
}) {
  const activeSort = value?.sort ?? defaultOrdering.sort
  const activeDirection = value?.direction ?? defaultOrdering.direction
  const applyValue = (next: { direction: SortDirection; sort: TSort }) => {
    if (
      next.sort === defaultOrdering.sort &&
      next.direction === defaultOrdering.direction
    ) {
      onChange(null)
      return
    }
    onChange(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        id={`${idPrefix}-sort`}
        onChange={(event) => {
          const matched = options.find(
            (option) => option.value === event.target.value
          )
          if (!matched) return
          applyValue({
            direction: value?.direction ?? matched.defaultDirection,
            sort: matched.value,
          })
        }}
        value={activeSort}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label={`${label} direction`}
        id={`${idPrefix}-direction`}
        onChange={(event) => {
          const direction = event.target.value === "asc" ? "asc" : "desc"
          applyValue({ direction, sort: activeSort })
        }}
        value={activeDirection}
      >
        <NativeSelectOption value="asc">Ascending</NativeSelectOption>
        <NativeSelectOption value="desc">Descending</NativeSelectOption>
      </NativeSelect>
    </div>
  )
}

function ResourceSequenceSelect({
  id,
  label,
  onChange,
  options,
  value,
}: {
  id: string
  label: string
  onChange: (value: ResourceSequencePreference | null) => void
  options: readonly {
    label: string
    value: ResourceSequencePreference["scope"]
  }[]
  value: ResourceSequencePreference | undefined
}) {
  const active = value ?? defaultResourceSequence
  const apply = (next: ResourceSequencePreference) =>
    onChange(isDefaultResourceSequence(next) ? null : next)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        id={id}
        onChange={(event) => {
          const scope = options.find(
            (option) => option.value === event.target.value
          )?.value
          if (scope) apply({ ...active, scope })
        }}
        value={active.scope}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {active.scope === "off" ? null : (
        <DefaultSortSelect
          defaultOrdering={{
            direction: defaultResourceSequence.direction,
            sort: defaultResourceSequence.sort,
          }}
          idPrefix={id}
          label={label}
          onChange={(order) =>
            apply({
              ...active,
              direction: order?.direction ?? defaultResourceSequence.direction,
              sort: order?.sort ?? defaultResourceSequence.sort,
            })
          }
          options={dataSortOptions}
          value={{ direction: active.direction, sort: active.sort }}
        />
      )}
    </div>
  )
}

function LabelPrinterField() {
  const scope = useWorkspaceScope()
  const printers = useQuery(printersQueryOptions(scope))
  const { preferences, update } = useAccountPreferences()
  const remembered = preferences.hub?.label_printer
  const printerIds = Array.from(
    new Set([
      ...(printers.data ?? []).map((printer) => printer.printer_id),
      ...(remembered ? [remembered] : []),
    ])
  )
  if (printerIds.length === 0) return null

  return (
    <>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>Labels</FieldLegend>
        <PreferenceField
          id="preferred-label-printer"
          title="Default label printer"
        >
          <NativeSelect
            id="preferred-label-printer"
            onChange={(event) =>
              update({ hub: { label_printer: event.target.value || null } })
            }
            value={remembered ?? ""}
          >
            <NativeSelectOption value="">First online</NativeSelectOption>
            {printerIds.map((printerId) => (
              <NativeSelectOption key={printerId} value={printerId}>
                {printerId}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </PreferenceField>
      </FieldSet>
    </>
  )
}

function GeneralPreferences() {
  const { preferences, update } = useAccountPreferences()
  const { setTheme, theme } = useThemePreference()

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>Appearance</FieldLegend>
        <PreferenceField title="Theme">
          <SegmentedControl
            ariaLabel="Theme"
            onValueChange={setTheme}
            options={themeOptions}
            value={preferences.theme ?? theme}
          />
        </PreferenceField>
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>Home</FieldLegend>
        <PreferenceField title="Recently added data">
          <SegmentedControl
            ariaLabel="Recently added data"
            onValueChange={(value) =>
              update({ hub: { home_recent_scope: value } })
            }
            options={recentScopeOptions}
            value={preferences.hub?.home_recent_scope ?? "all"}
          />
        </PreferenceField>
      </FieldSet>
      <LabelPrinterField />
    </FieldGroup>
  )
}

function BrowsingPreferences() {
  const { preferences, update } = useAccountPreferences()

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>Data</FieldLegend>
        <PreferenceField title="Default data view">
          <SegmentedControl
            ariaLabel="Default data view"
            onValueChange={(value) => update({ default_record_kind: value })}
            options={recordKindOptions}
            value={preferences.default_record_kind ?? "samples"}
          />
        </PreferenceField>
        <PreferenceField
          description="Lists and search start with public data included."
          id="include-public-data"
          title="Include public data"
        >
          <Switch
            checked={preferences.hub?.include_public_data === true}
            id="include-public-data"
            onCheckedChange={(checked) =>
              update({ hub: { include_public_data: checked } })
            }
          />
        </PreferenceField>
        <PreferenceField
          id="preferred-data-sort-sort"
          title="Default data sort"
        >
          <DefaultSortSelect
            defaultOrdering={defaultCollectionOrdering}
            idPrefix="preferred-data-sort"
            label="Default data sort"
            onChange={(value) =>
              update({ hub: { default_sort: { data: value } } })
            }
            options={dataSortOptions}
            value={preferences.hub?.default_sort?.data}
          />
        </PreferenceField>
        <PreferenceField
          id="preferred-sample-grouping"
          title="Group samples by"
        >
          <GroupingSelect
            id="preferred-sample-grouping"
            onChange={(value) =>
              update({ hub: { data_group_by: { samples: value } } })
            }
            options={globalSampleBrowseOptions}
            value={preferences.hub?.data_group_by?.samples}
          />
        </PreferenceField>
        <PreferenceField
          id="preferred-dataset-grouping"
          title="Group datasets by"
        >
          <GroupingSelect
            id="preferred-dataset-grouping"
            onChange={(value) =>
              update({ hub: { data_group_by: { datasets: value } } })
            }
            options={globalDatasetBrowseOptions}
            value={preferences.hub?.data_group_by?.datasets}
          />
        </PreferenceField>
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>Directories</FieldLegend>
        <PreferenceField
          id="preferred-project-sort-sort"
          title="Default project sort"
        >
          <DefaultSortSelect
            defaultOrdering={defaultDirectoryOrdering}
            idPrefix="preferred-project-sort"
            label="Default project sort"
            onChange={(value) =>
              update({ hub: { default_sort: { projects: value } } })
            }
            options={directorySortOptions}
            value={preferences.hub?.default_sort?.projects}
          />
        </PreferenceField>
        <PreferenceField
          id="preferred-instrument-sort-sort"
          title="Default instrument sort"
        >
          <DefaultSortSelect
            defaultOrdering={defaultDirectoryOrdering}
            idPrefix="preferred-instrument-sort"
            label="Default instrument sort"
            onChange={(value) =>
              update({ hub: { default_sort: { instruments: value } } })
            }
            options={directorySortOptions}
            value={preferences.hub?.default_sort?.instruments}
          />
        </PreferenceField>
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>Browse nearby</FieldLegend>
        <FieldDescription>
          Sets Previous and Next for records opened outside a list. Records with
          no project use the same sample type or measurement.
        </FieldDescription>
        <PreferenceField id="preferred-sample-sequence" title="Nearby samples">
          <ResourceSequenceSelect
            id="preferred-sample-sequence"
            label="Nearby samples"
            onChange={(value) =>
              update({ hub: { resource_sequence: { samples: value } } })
            }
            options={sampleSequenceOptions}
            value={preferences.hub?.resource_sequence?.samples}
          />
        </PreferenceField>
        <PreferenceField
          id="preferred-dataset-sequence"
          title="Nearby datasets"
        >
          <ResourceSequenceSelect
            id="preferred-dataset-sequence"
            label="Nearby datasets"
            onChange={(value) =>
              update({ hub: { resource_sequence: { datasets: value } } })
            }
            options={datasetSequenceOptions}
            value={preferences.hub?.resource_sequence?.datasets}
          />
        </PreferenceField>
      </FieldSet>
    </FieldGroup>
  )
}

function HistoryPreferences() {
  const { preferences, update } = useAccountPreferences()
  const [clearOpen, setClearOpen] = useState(false)
  const clearHistory = useClearRecentHistory(() => setClearOpen(false))

  return (
    <>
      <FieldGroup>
        <FieldSet>
          <FieldLegend>History</FieldLegend>
          <PreferenceField
            description="Shown in the sidebar and on Home on every device."
            id="record-recent-resources"
            title="Remember recently viewed resources"
          >
            <Switch
              checked={preferences.record_recent_resources !== false}
              id="record-recent-resources"
              onCheckedChange={(checked) =>
                update({ record_recent_resources: checked })
              }
            />
          </PreferenceField>
          <PreferenceField title="Recently viewed list">
            <Button
              onClick={() => setClearOpen(true)}
              type="button"
              variant="outline"
            >
              Clear history
            </Button>
          </PreferenceField>
        </FieldSet>
      </FieldGroup>
      <ConfirmationDialog
        confirmLabel="Clear history"
        description="Your list will be empty on every device. The resources are not affected."
        kind="alert"
        onConfirm={() => clearHistory.mutate()}
        onOpenChange={setClearOpen}
        open={clearOpen}
        pending={clearHistory.isPending}
        pendingLabel="Clearing history"
        title="Clear recently viewed history?"
        variant="destructive"
      />
    </>
  )
}

function PreferencesPage() {
  const scope = useWorkspaceScope()
  useSuspenseQuery(accountPreferencesQueryOptions(scope))
  const { saving } = useAccountPreferences()
  const { tab = "general" } = Route.useSearch()

  return (
    <PageLayout>
      <PageHeader
        description="Saved to your account and used wherever you sign in."
        title="Preferences"
      />
      <ResourceSectionNavigation
        actions={
          <p
            aria-live="polite"
            className="flex min-h-5 items-center gap-1.5 text-supporting text-muted-foreground"
            role="status"
          >
            {saving ? (
              <>
                <PendingIcon />
                Saving…
              </>
            ) : null}
          </p>
        }
        label="Preference sections"
      >
        {preferenceTabs.map((item) => (
          <Link
            aria-current={item.value === tab ? "page" : undefined}
            className={cn(
              resourceSectionLinkClassName,
              item.value === tab && resourceSectionActiveProps.className
            )}
            key={item.value}
            resetScroll={false}
            search={item.value === "general" ? {} : { tab: item.value }}
            to="/preferences"
          >
            {item.label}
          </Link>
        ))}
      </ResourceSectionNavigation>
      <ResourceSectionPanel>
        <ContentBoundary width="reading">
          <Card>
            <CardContent>
              {tab === "browsing" ? (
                <BrowsingPreferences />
              ) : tab === "history" ? (
                <HistoryPreferences />
              ) : (
                <GeneralPreferences />
              )}
            </CardContent>
          </Card>
        </ContentBoundary>
      </ResourceSectionPanel>
    </PageLayout>
  )
}
