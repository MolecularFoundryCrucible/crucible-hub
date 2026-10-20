import { useId, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"

import { PrintLabelIcon } from "@/components/crucible/icons"
import { MfidText } from "@/components/crucible/mfid-text"
import { notifySuccess } from "@/components/crucible/notifications"
import { PendingIcon } from "@/components/crucible/pending-icon"
import { useWorkspaceScope } from "@/components/crucible/workspace-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fixtureScenarioFromScope } from "@/data/crucible/fixture-scenarios"
import { labelNameMaxLength } from "@/data/crucible/print"
import { printWorkspaceResourceLabel } from "@/data/crucible/print.functions"
import { printersQueryOptions } from "@/data/crucible/print.queries"
import { hubErrorMessage, unwrapHubResult } from "@/data/crucible/result"
import { useAccountPreferences } from "@/features/preferences/use-account-preferences"

export function PrintLabelButton({
  mfid,
  name,
  variant = "button",
}: {
  mfid: string
  name: string
  variant?: "button" | "icon"
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!pending) setOpen(next)
      }}
      open={open}
    >
      {variant === "icon" ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button
                    aria-label="Print"
                    className="shrink-0"
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  />
                }
              />
            }
          >
            <PrintLabelIcon aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Print</TooltipContent>
        </Tooltip>
      ) : (
        <DialogTrigger
          render={<Button size="sm" type="button" variant="outline" />}
        >
          <PrintLabelIcon aria-hidden="true" data-icon="inline-start" />
          Print
        </DialogTrigger>
      )}
      {open ? (
        <PrintLabelDialogContent
          mfid={mfid}
          name={name}
          onDone={() => setOpen(false)}
          onPendingChange={setPending}
          pending={pending}
        />
      ) : null}
    </Dialog>
  )
}

function PrintLabelDialogContent({
  mfid,
  name,
  onDone,
  onPendingChange,
  pending,
}: {
  mfid: string
  name: string
  onDone: () => void
  onPendingChange: (pending: boolean) => void
  pending: boolean
}) {
  const scope = useWorkspaceScope()
  const printerId = useId()
  const nameId = useId()
  const { preferences, update } = useAccountPreferences()
  const printers = useQuery(printersQueryOptions(scope))
  const [chosenPrinter, setChosenPrinter] = useState<string>()
  const [labelName, setLabelName] = useState(
    name.trim().slice(0, labelNameMaxLength)
  )
  const [error, setError] = useState<string>()

  const onlinePrinters = (printers.data ?? []).filter(
    (printer) => printer.online
  )
  const remembered = preferences.hub?.label_printer
  const selectedPrinter =
    chosenPrinter ??
    (onlinePrinters.some((printer) => printer.printer_id === remembered)
      ? remembered
      : onlinePrinters[0]?.printer_id)

  const mutation = useMutation({
    mutationFn: async (printer: string) =>
      unwrapHubResult(
        await printWorkspaceResourceLabel({
          data: {
            mfid,
            name: labelName.trim(),
            printerId: printer,
            scenario: fixtureScenarioFromScope(scope),
          },
        })
      ),
  })

  async function print() {
    if (!selectedPrinter || !labelName.trim()) return
    setError(undefined)
    onPendingChange(true)
    try {
      const result = await mutation.mutateAsync(selectedPrinter)
      if (result.status === "ok") {
        if (remembered !== selectedPrinter) {
          update({ hub: { label_printer: selectedPrinter } })
        }
        notifySuccess(`Label printed on ${selectedPrinter}`)
        onDone()
        return
      }
      setError(
        [
          result.status === "error"
            ? "The printer reported an error."
            : "The printer did not respond.",
          result.detail,
        ]
          .filter(Boolean)
          .join(" ")
      )
    } catch (cause) {
      setError(hubErrorMessage(cause, "The label could not be printed."))
    } finally {
      onPendingChange(false)
    }
  }

  return (
    <DialogContent showCloseButton={!pending}>
      <DialogHeader>
        <DialogTitle>Print</DialogTitle>
      </DialogHeader>
      <form
        className="contents"
        onSubmit={(event) => {
          event.preventDefault()
          void print()
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={printerId}>Printer</FieldLabel>
            {printers.isError ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body text-destructive" role="alert">
                  {hubErrorMessage(
                    printers.error,
                    "Printers could not be loaded."
                  )}
                </p>
                <Button
                  onClick={() => void printers.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Try again
                </Button>
              </div>
            ) : (
              <NativeSelect
                className="w-full"
                disabled={pending || printers.isPending}
                id={printerId}
                onChange={(event) => setChosenPrinter(event.target.value)}
                value={selectedPrinter ?? ""}
              >
                {printers.isPending ? (
                  <NativeSelectOption value="">
                    Loading printers
                  </NativeSelectOption>
                ) : !selectedPrinter ? (
                  <NativeSelectOption disabled value="">
                    No printer is online
                  </NativeSelectOption>
                ) : null}
                {(printers.data ?? []).map((printer) => (
                  <NativeSelectOption
                    disabled={!printer.online}
                    key={printer.printer_id}
                    value={printer.printer_id}
                  >
                    {printer.online
                      ? printer.printer_id
                      : `${printer.printer_id} (offline)`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor={nameId}>Label name</FieldLabel>
            <Input
              disabled={pending}
              id={nameId}
              maxLength={labelNameMaxLength}
              onChange={(event) => setLabelName(event.target.value)}
              value={labelName}
            />
          </Field>
          <dl>
            <dt className="text-label text-muted-foreground">MFID</dt>
            <dd className="mt-1">
              <MfidText value={mfid} />
            </dd>
          </dl>
        </FieldGroup>
        {error ? (
          <p className="text-body text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={onDone}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={pending || !selectedPrinter || !labelName.trim()}
            type="submit"
          >
            {pending ? (
              <PendingIcon data-icon="inline-start" />
            ) : (
              <PrintLabelIcon aria-hidden="true" data-icon="inline-start" />
            )}
            {pending ? "Printing" : "Print"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
