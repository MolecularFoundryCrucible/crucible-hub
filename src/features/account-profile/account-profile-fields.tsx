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

export const accountProfileSchema = z.object({
  email: z
    .string()
    .trim()
    .max(320, "Use 320 characters or fewer for email.")
    .email("Enter a valid email address."),
  first_name: z
    .string()
    .trim()
    .max(255, "Use 255 characters or fewer for first name."),
  last_name: z
    .string()
    .trim()
    .max(255, "Use 255 characters or fewer for last name."),
  username: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters for username.")
    .max(24, "Use 24 characters or fewer for username.")
    .regex(
      /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/,
      "Start with a lowercase letter and use lowercase letters, numbers, hyphens, or underscores."
    ),
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
    if (normalized[field] !== initial[field].trim()) {
      changes[field] =
        (field === "first_name" || field === "last_name") && !normalized[field]
          ? null
          : normalized[field]
    }
  }
  return changes
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

export function ProfileField({
  description,
  endAdornment,
  field,
  invalid = false,
  label,
  maxLength = 255,
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
  required?: boolean
  type?: "email" | "text"
}) {
  const inputProps = {
    "aria-invalid": invalid || !field.state.meta.isValid || undefined,
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
    <Field data-invalid={invalid || !field.state.meta.isValid}>
      <FieldLabel htmlFor={field.name} optional={!required}>
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
      <FieldError errors={field.state.meta.errors} />
    </Field>
  )
}
