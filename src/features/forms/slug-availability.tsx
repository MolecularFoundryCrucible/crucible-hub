import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, ReactNode, SetStateAction } from "react"
import type { z } from "zod"

import {
  AvailabilityAvailableIcon,
  AvailabilityCheckingIcon,
  AvailabilityTakenIcon,
  AvailabilityUnavailableIcon,
} from "@/components/crucible/icons"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { FormFieldLike } from "./field-state"
import { fieldErrors, shouldShowFieldError } from "./field-state"
import { PendingIcon } from "@/components/crucible/pending-icon"

export type SlugAvailabilityStatus =
  "checking" | "no-exact-match" | "taken" | "error"

type CheckResult = {
  candidate: string
  result: "taken" | "no-exact-match" | "error"
}

export function isSlugTakenOrRejected(
  value: string,
  liveTaken?: string,
  rejected?: string
): boolean {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  if (liveTaken && normalized === liveTaken.trim().toLowerCase()) return true
  if (rejected && normalized === rejected.trim().toLowerCase()) return true
  return false
}

export function useSlugConflict() {
  const [liveTaken, setLiveTaken] = useState<string>()
  const [rejected, setRejected] = useState<string>()
  const reject = useCallback((value: string | null | undefined) => {
    if (value) setRejected(value)
  }, [])
  const reset = useCallback(() => {
    setLiveTaken(undefined)
    setRejected(undefined)
  }, [])
  return {
    fieldProps: { onLiveTakenChange: setLiveTaken, rejectedValue: rejected },
    isTaken: (value: string) =>
      isSlugTakenOrRejected(value, liveTaken, rejected),
    reject,
    reset,
  }
}

export function useSlugAvailability({
  candidate,
  checkAvailability,
  currentValue,
  debounceMs = 400,
  entityLabel = "Slug",
  onLiveTakenChange,
  rejectedValue,
  validate,
}: {
  candidate: string
  checkAvailability: (
    candidate: string,
    signal: AbortSignal
  ) => Promise<boolean>
  currentValue?: string | null
  debounceMs?: number
  entityLabel?: string
  onLiveTakenChange?:
    | Dispatch<SetStateAction<string | undefined>>
    | ((candidate: string | undefined) => void)
  rejectedValue?: string | null
  validate: (candidate: string) => boolean
}) {
  const [checked, setChecked] = useState<CheckResult>()
  const checkAvailabilityRef = useRef(checkAvailability)
  const onLiveTakenChangeRef = useRef(onLiveTakenChange)
  useEffect(() => {
    checkAvailabilityRef.current = checkAvailability
    onLiveTakenChangeRef.current = onLiveTakenChange
  })
  const trimmedCandidate = candidate.trim()
  const rejected = Boolean(
    rejectedValue &&
    trimmedCandidate.toLowerCase() === rejectedValue.trim().toLowerCase()
  )
  const isCurrent = Boolean(
    currentValue &&
    trimmedCandidate.toLowerCase() === currentValue.trim().toLowerCase()
  )
  const shouldCheck =
    Boolean(trimmedCandidate) &&
    !rejected &&
    !isCurrent &&
    validate(trimmedCandidate)

  useEffect(() => {
    if (isCurrent) {
      onLiveTakenChange?.(undefined)
    }
  }, [isCurrent, onLiveTakenChange])

  useEffect(() => {
    if (!shouldCheck) return
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => {
      void checkAvailabilityRef
        .current(trimmedCandidate, controller.signal)
        .then((taken) => {
          if (!active) return
          setChecked({
            candidate: trimmedCandidate,
            result: taken ? "taken" : "no-exact-match",
          })
          onLiveTakenChangeRef.current?.(taken ? trimmedCandidate : undefined)
        })
        .catch(() => {
          if (active) {
            setChecked({ candidate: trimmedCandidate, result: "error" })
          }
        })
    }, debounceMs)

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [debounceMs, shouldCheck, trimmedCandidate])

  const status: SlugAvailabilityStatus | null = rejected
    ? "taken"
    : !shouldCheck
      ? null
      : checked?.candidate.toLowerCase() === trimmedCandidate.toLowerCase()
        ? checked.result
        : "checking"

  const Icon =
    status === "taken"
      ? AvailabilityTakenIcon
      : status === "no-exact-match"
        ? AvailabilityAvailableIcon
        : status === "error"
          ? AvailabilityUnavailableIcon
          : AvailabilityCheckingIcon

  const label =
    status === "taken"
      ? `${entityLabel} already taken`
      : status === "no-exact-match"
        ? "No exact match. Final availability check on save."
        : status === "error"
          ? "Could not check now. Save will verify."
          : `Checking ${entityLabel.toLowerCase()}`

  const adornment: ReactNode = status ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <InputGroupText
            className={
              status === "taken"
                ? "text-destructive"
                : status === "no-exact-match"
                  ? "text-success"
                  : undefined
            }
            role="status"
            tabIndex={0}
          />
        }
      >
        {status === "checking" ? <PendingIcon /> : <Icon aria-hidden="true" />}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  ) : (
    <InputGroupText aria-hidden="true" className="invisible">
      <AvailabilityCheckingIcon />
    </InputGroupText>
  )

  return {
    adornment,
    isChecking: status === "checking",
    isTaken: status === "taken",
    label,
    status,
  }
}

export function SlugAvailabilityField({
  autoComplete,
  autoFocus = false,
  checkAvailability,
  currentValue,
  description,
  descriptionId: explicitDescriptionId,
  entityLabel,
  errorId: explicitErrorId,
  field,
  id: explicitId,
  invalid = false,
  label,
  maxLength = 25,
  onLiveTakenChange,
  placeholder,
  rejectedValue,
  required = false,
  schema,
  type,
}: {
  autoComplete?: string
  autoFocus?: boolean
  checkAvailability: (
    candidate: string,
    signal: AbortSignal
  ) => Promise<boolean>
  currentValue?: string | null
  description?: string
  descriptionId?: string
  entityLabel?: string
  errorId?: string
  field: FormFieldLike & {
    handleBlur: () => void
    handleChange: (value: string) => void
    name: string
    state: {
      meta: {
        errors?: Array<{ message?: string } | undefined>
        isBlurred?: boolean
        isDirty?: boolean
        isTouched?: boolean
        isValid: boolean
      }
      value: string
    }
  }
  id?: string
  invalid?: boolean
  label: string
  maxLength?: number
  onLiveTakenChange?:
    | Dispatch<SetStateAction<string | undefined>>
    | ((candidate: string | undefined) => void)
  placeholder?: string
  rejectedValue?: string | null
  required?: boolean
  schema: z.ZodType<string>
  type?: string
}) {
  const { adornment, isTaken } = useSlugAvailability({
    candidate: field.state.value,
    checkAvailability,
    currentValue,
    entityLabel: entityLabel ?? label,
    onLiveTakenChange,
    rejectedValue,
    validate: (candidate) => schema.safeParse(candidate).success,
  })

  const fieldId = explicitId ?? field.name
  const descriptionId = explicitDescriptionId ?? `${fieldId}-description`
  const errorId = explicitErrorId ?? `${fieldId}-error`
  const hasDescription = Boolean(description)
  const hasFormatError = Boolean(field.state.value && !field.state.meta.isValid)
  const isInvalid = Boolean(
    invalid || isTaken || hasFormatError || shouldShowFieldError(field)
  )

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={fieldId} optional={!required} required={required}>
        {label}
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          aria-describedby={
            hasDescription ? `${descriptionId} ${errorId}` : errorId
          }
          aria-errormessage={isInvalid ? errorId : undefined}
          aria-invalid={isInvalid || undefined}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          id={fieldId}
          maxLength={maxLength}
          name={field.name}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          type={type}
          value={field.state.value}
        />
        <InputGroupAddon align="inline-end">{adornment}</InputGroupAddon>
      </InputGroup>
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      <FieldError
        errors={fieldErrors(field, {
          extraErrors: isTaken
            ? [{ message: `${entityLabel ?? label} already taken.` }]
            : undefined,
          invalid: isInvalid,
        })}
        id={errorId}
      />
    </Field>
  )
}
