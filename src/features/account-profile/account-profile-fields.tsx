import { z } from "zod"
import type { ChangeEvent, ReactNode } from "react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import type {
  WorkspaceAccount,
  WorkspaceAccountProfileUpdate,
} from "@/data/crucible/workspace-source"

import { emailSchema, usernameSchema } from "@/data/crucible/slugs"

const accountProfileSchema = z.object({
  email: emailSchema,
  first_name: z
    .string()
    .trim()
    .max(255, "Use 255 characters or fewer for first name."),
  last_name: z
    .string()
    .trim()
    .max(255, "Use 255 characters or fewer for last name."),
  username: usernameSchema,
})

export type AccountProfileValues = z.infer<typeof accountProfileSchema>

const profileFields = ["first_name", "last_name", "email", "username"] as const

export function accountProfileValues(
  account: WorkspaceAccount
): AccountProfileValues {
  return {
    email: account.email ?? "",
    first_name: account.first_name,
    last_name: account.last_name,
    username: account.username ?? "",
  }
}

export function accountProfileChanges(
  account: WorkspaceAccount,
  values: AccountProfileValues
): WorkspaceAccountProfileUpdate {
  const normalized = accountProfileSchema.parse(values)
  const initial = accountProfileValues(account)
  const changes: WorkspaceAccountProfileUpdate = {}

  for (const field of profileFields) {
    if (normalized[field] === initial[field].trim()) continue
    if (field === "first_name" || field === "last_name") {
      if (normalized[field]) changes[field] = normalized[field]
    } else {
      changes[field] = normalized[field]
    }
  }
  return changes
}

export function accountProfileFormSchema(account: WorkspaceAccount) {
  return accountProfileSchema.superRefine((values, context) => {
    for (const field of ["first_name", "last_name"] as const) {
      if (!values[field] && account[field].trim()) {
        context.addIssue({
          code: "custom",
          message:
            field === "first_name"
              ? "Enter a first name."
              : "Enter a last name.",
          path: [field],
        })
      }
    }
  })
}

export function profileNameMissing(state: {
  values: Pick<AccountProfileValues, "first_name" | "last_name">
}) {
  return !state.values.first_name.trim() && !state.values.last_name.trim()
}

export function ProfileNameHint() {
  return (
    <p className="text-supporting text-muted-foreground">
      Add your name so collaborators can recognize you.
    </p>
  )
}

export function accountProfileHasChanges(
  account: WorkspaceAccount,
  values: AccountProfileValues
) {
  const initial = accountProfileValues(account)
  return profileFields.some(
    (field) => values[field].trim() !== initial[field].trim()
  )
}

export function matchesRejectedValue(value: string, rejected?: string) {
  return (
    rejected !== undefined &&
    value.trim().toLowerCase() === rejected.trim().toLowerCase()
  )
}

export function ProfileField({
  description,
  endAdornment,
  field,
  invalid = false,
  label,
  maxLength = 255,
  rejectedMessage = "This value is already used by another account.",
  rejectedValue,
  required = false,
  type = "text",
}: {
  description?: string
  endAdornment?: ReactNode
  field: {
    handleBlur: () => void
    handleChange: (value: string) => void
    name: string
    state: {
      meta: {
        errors: Array<{ message?: string } | undefined>
        isValid: boolean
      }
      value: string
    }
  }
  invalid?: boolean
  label: string
  maxLength?: number
  rejectedMessage?: string
  rejectedValue?: string
  required?: boolean
  type?: "email" | "text"
}) {
  const rejected = matchesRejectedValue(field.state.value, rejectedValue)
  const fieldInvalid = invalid || rejected
  const inputProps = {
    "aria-invalid": fieldInvalid || !field.state.meta.isValid || undefined,
    autoComplete:
      field.name === "first_name"
        ? "given-name"
        : field.name === "last_name"
          ? "family-name"
          : field.name === "username"
            ? "nickname"
            : field.name,
    id: field.name,
    maxLength,
    name: field.name,
    onBlur: field.handleBlur,
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      field.handleChange(event.target.value),
    required,
    type,
    value: field.state.value,
  }
  return (
    <Field data-invalid={fieldInvalid || !field.state.meta.isValid}>
      <FieldLabel htmlFor={field.name} optional={!required} required={required}>
        {label}
      </FieldLabel>
      {endAdornment ? (
        <InputGroup>
          <InputGroupInput {...inputProps} />
          <InputGroupAddon align="inline-end">{endAdornment}</InputGroupAddon>
        </InputGroup>
      ) : (
        <Input {...inputProps} />
      )}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError
        errors={
          rejected
            ? [...field.state.meta.errors, { message: rejectedMessage }]
            : field.state.meta.errors
        }
      />
    </Field>
  )
}
