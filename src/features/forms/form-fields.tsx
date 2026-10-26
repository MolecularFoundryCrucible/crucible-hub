import type { ComponentProps, ReactNode } from "react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useFieldContext } from "@/features/forms/form-context"
import { fieldErrors, shouldShowFieldError } from "@/features/forms/field-state"

type FieldFrameProps = {
  description?: ReactNode
  label: string
  required?: boolean
}

type ControlProps<T> = Omit<
  T,
  "aria-describedby" | "id" | "name" | "onBlur" | "onChange" | "value"
>

function useTextField() {
  const field = useFieldContext<string>()
  const invalid = shouldShowFieldError(field)
  const descriptionId = `${field.name}-description`
  const errorId = `${field.name}-error`
  return { descriptionId, errorId, field, invalid }
}

function FieldFrame({
  children,
  description,
  label,
  required,
}: FieldFrameProps & { children: ReactNode }) {
  const { descriptionId, errorId, field, invalid } = useTextField()
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name} optional={!required} required={required}>
        {label}
      </FieldLabel>
      {children}
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      <FieldError errors={fieldErrors(field, { invalid })} id={errorId} />
    </Field>
  )
}

function useControlProps(description: ReactNode) {
  const { descriptionId, errorId, field, invalid } = useTextField()
  return {
    "aria-describedby":
      [description ? descriptionId : null, invalid ? errorId : null]
        .filter(Boolean)
        .join(" ") || undefined,
    "aria-errormessage": invalid ? errorId : undefined,
    "aria-invalid": invalid || undefined,
    id: field.name,
    name: field.name,
    onBlur: field.handleBlur,
    onChange: (event: { target: { value: string } }) =>
      field.handleChange(event.target.value),
    value: field.state.value,
  }
}

/** A labelled single-line text input bound to the surrounding form field. */
export function TextField({
  description,
  label,
  required = false,
  ...props
}: FieldFrameProps & ControlProps<ComponentProps<typeof Input>>) {
  const control = useControlProps(description)
  return (
    <FieldFrame description={description} label={label} required={required}>
      <Input {...props} {...control} required={required} />
    </FieldFrame>
  )
}

/** A labelled multi-line text input bound to the surrounding form field. */
export function TextAreaField({
  description,
  label,
  required = false,
  ...props
}: FieldFrameProps & ControlProps<ComponentProps<typeof Textarea>>) {
  const control = useControlProps(description)
  return (
    <FieldFrame description={description} label={label} required={required}>
      <Textarea {...props} {...control} required={required} />
    </FieldFrame>
  )
}
