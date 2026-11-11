import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { ActivityTime } from "@/components/crucible/activity-time"
import { PanelState } from "@/components/crucible/collection-state"
import { notifySuccess } from "@/components/crucible/notifications"
import { DelayedPendingIcon } from "@/components/crucible/pending-icon"
import { StatusBadge } from "@/components/crucible/status-badge"
import {
  useFeatureEnabled,
  useWorkspaceScope,
} from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
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
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { startDatasetPostprocessingFn } from "@/data/crucible/postprocessing.functions"
import {
  datasetPostprocessingRunsQueryOptions,
  pipelinesQueryOptions,
} from "@/data/crucible/postprocessing.queries"
import { crucibleKeys } from "@/data/crucible/query-keys"
import {
  HubApiClientError,
  hubErrorMessage,
  unwrapHubResult,
} from "@/data/crucible/result"
import type {
  WorkspacePipeline,
  WorkspacePostprocessingRun,
} from "@/data/crucible/workspace-source"

import {
  pipelineDescription,
  pipelineLabel,
  pipelineParameterFields,
  pipelineParameters,
} from "./postprocessing-parameters"
import type { PipelineParameterField } from "./postprocessing-parameters"

function unavailable(error: unknown) {
  return (
    error instanceof HubApiClientError && error.details.kind === "unavailable"
  )
}

export function PostprocessingCard({
  canRun,
  datasetMfid,
}: {
  canRun: boolean
  datasetMfid: string
}) {
  const scope = useWorkspaceScope()
  const ingestionEnabled = useFeatureEnabled("ingestion")
  const runsResult = useQuery({
    ...datasetPostprocessingRunsQueryOptions(scope, datasetMfid),
    enabled: ingestionEnabled,
  })
  const pipelinesResult = useQuery({
    ...pipelinesQueryOptions(scope),
    enabled: canRun && ingestionEnabled,
  })
  const [open, setOpen] = useState(false)
  const pipelines = pipelinesResult.data ?? []
  const runs = runsResult.data?.items ?? []
  const turnedOff =
    !ingestionEnabled ||
    unavailable(runsResult.error) ||
    unavailable(pipelinesResult.error)

  return (
    <Card aria-busy={runsResult.isFetching}>
      <CardHeader>
        <CardTitle>Post-processing</CardTitle>
        {canRun && pipelines.length > 0 && !turnedOff ? (
          <CardAction>
            <Button onClick={() => setOpen(true)} size="sm" variant="outline">
              Run pipeline
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={runs.length > 0 ? "px-0" : undefined}>
        {turnedOff ? (
          <PanelState title="Post-processing isn't turned on for this Crucible server" />
        ) : runsResult.isPending ? (
          <PanelState title="Loading post-processing runs" />
        ) : runsResult.isError && runs.length === 0 ? (
          <PanelState
            retry={() => void runsResult.refetch()}
            role="alert"
            title="Post-processing runs could not be loaded"
          />
        ) : runs.length === 0 ? (
          <PanelState title="No post-processing runs yet" />
        ) : (
          <PostprocessingRunsTable runs={runs} />
        )}
      </CardContent>
      {canRun ? (
        <RunPipelineDialog
          datasetMfid={datasetMfid}
          onOpenChange={setOpen}
          open={open}
          pipelines={pipelines}
        />
      ) : null}
    </Card>
  )
}

function PostprocessingRunsTable({
  runs,
}: {
  runs: readonly WorkspacePostprocessingRun[]
}) {
  return (
    <Table aria-label="Post-processing runs">
      <TableHeader>
        <TableRow>
          <TableHead className="pl-(--card-spacing)">Pipeline</TableHead>
          <TableHead>Status</TableHead>
          <TableHead kind="date">Requested</TableHead>
          <TableHead className="pr-(--card-spacing)" kind="date">
            Finished
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.run_id}>
            <TableCell className="pl-(--card-spacing)">
              <span className="flex min-w-0 flex-col">
                <span className="text-label">
                  {pipelineLabel(run.pipeline)}
                </span>
                {run.status === "failed" && run.error ? (
                  <span className="text-supporting break-words text-destructive">
                    {run.error}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell>
              <StatusBadge domain="ingestion" status={run.status} />
            </TableCell>
            <TableCell kind="date">
              <ActivityTime fallback="" value={run.requested_at} />
            </TableCell>
            <TableCell className="pr-(--card-spacing)" kind="date">
              <ActivityTime fallback="" value={run.finished_at} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RunPipelineDialog({
  datasetMfid,
  onOpenChange,
  open,
  pipelines,
}: {
  datasetMfid: string
  onOpenChange: (open: boolean) => void
  open: boolean
  pipelines: readonly WorkspacePipeline[]
}) {
  const scope = useWorkspaceScope()
  const queryClient = useQueryClient()
  const [pipelineName, setPipelineName] = useState("")
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [idempotencyKey, setIdempotencyKey] = useState("")
  const [error, setError] = useState<string>()
  const pipeline = pipelines.find(
    (candidate) => candidate.name === pipelineName
  )
  const fields = useMemo(
    () => (pipeline ? pipelineParameterFields(pipeline.parameters_schema) : []),
    [pipeline]
  )
  const parameters = fields ? pipelineParameters(fields, values) : null
  const mutation = useMutation({
    mutationFn: async () =>
      unwrapHubResult(
        await startDatasetPostprocessingFn({
          data: {
            datasetMfid,
            idempotencyKey,
            parameters: parameters ?? {},
            pipeline: pipelineName,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: crucibleKeys.datasetPostprocessingRuns(scope, datasetMfid),
      })
      notifySuccess("Post-processing started")
      onOpenChange(false)
    },
    onError: (cause) => {
      setError(hubErrorMessage(cause, "The pipeline could not be started."))
    },
  })

  return (
    <Dialog
      onOpenChange={(next) => {
        if (mutation.isPending) return
        onOpenChange(next)
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) return
        setPipelineName(pipelines.length === 1 ? pipelines[0].name : "")
        setValues({})
        setError(undefined)
        setIdempotencyKey(crypto.randomUUID())
      }}
      open={open}
    >
      <DialogContent showCloseButton={!mutation.isPending}>
        <DialogHeader>
          <DialogTitle>Run pipeline</DialogTitle>
        </DialogHeader>
        <form
          id="run-pipeline"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (!pipeline || !parameters || mutation.isPending) return
            setError(undefined)
            mutation.mutate()
          }}
        >
          <fieldset disabled={mutation.isPending}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="run-pipeline-name">Pipeline</FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="run-pipeline-name"
                  onChange={(event) => {
                    setPipelineName(event.target.value)
                    setValues({})
                  }}
                  value={pipelineName}
                >
                  <NativeSelectOption disabled value="">
                    Select pipeline
                  </NativeSelectOption>
                  {pipelines.map((candidate) => (
                    <NativeSelectOption
                      key={candidate.name}
                      value={candidate.name}
                    >
                      {pipelineLabel(candidate.name)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {pipeline ? (
                  <FieldDescription>
                    {pipelineDescription(pipeline.description)}
                  </FieldDescription>
                ) : null}
              </Field>
              {fields?.map((field) => (
                <ParameterInput
                  field={field}
                  key={field.name}
                  onChange={(value) =>
                    setValues((current) => ({
                      ...current,
                      [field.name]: value,
                    }))
                  }
                  value={values[field.name]}
                />
              ))}
              {pipeline && !fields ? (
                <p className="text-body text-muted-foreground">
                  This pipeline has settings the Hub can't show yet.
                </p>
              ) : null}
            </FieldGroup>
          </fieldset>
        </form>
        {error ? (
          <p className="text-body text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!pipeline || !parameters || mutation.isPending}
            form="run-pipeline"
            type="submit"
          >
            <DelayedPendingIcon
              data-icon="inline-start"
              pending={mutation.isPending}
            />
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ParameterInput({
  field,
  onChange,
  value,
}: {
  field: PipelineParameterField
  onChange: (value: string | boolean) => void
  value: string | boolean | undefined
}) {
  const id = `run-pipeline-${field.name}`
  if (field.kind === "boolean") {
    return (
      <Field orientation="horizontal">
        <Checkbox
          checked={value === true}
          id={id}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      </Field>
    )
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {field.label}
        {field.required ? null : (
          <span className="text-muted-foreground">(optional)</span>
        )}
      </FieldLabel>
      {field.kind === "choice" ? (
        <NativeSelect
          className="w-full"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={typeof value === "string" ? value : ""}
        >
          <NativeSelectOption value="">Select</NativeSelectOption>
          {field.options?.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : (
        <Input
          id={id}
          inputMode={field.kind === "text" ? undefined : "decimal"}
          onChange={(event) => onChange(event.target.value)}
          value={typeof value === "string" ? value : ""}
        />
      )}
      {field.description ? (
        <FieldDescription>{field.description}</FieldDescription>
      ) : null}
    </Field>
  )
}
