import { z } from "zod"
import type { ReactNode } from "react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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

  for (const field of [
    "first_name",
    "last_name",
    "email",
    "username",
  ] as const) {
    if (normalized[field] !== initial[field]) {
      changes[field] =
        (field === "first_name" || field === "last_name") && !normalized[field]
          ? null
          : normalized[field]
    }
  }
  return changes
}

export function ProfileField({
  children,
  description,
  field,
  label,
  maxLength = 255,
  required = false,
  type = "text",
}: {
  children?: ReactNode
  description?: string
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
  label: string
  maxLength?: number
  required?: boolean
  type?: "email" | "text"
}) {
  return (
    <Field data-invalid={!field.state.meta.isValid}>
      <FieldLabel htmlFor={field.name} optional={!required}>
        {label}
      </FieldLabel>
      <Input
        aria-invalid={!field.state.meta.isValid || undefined}
        autoComplete={
          field.name === "first_name"
            ? "given-name"
            : field.name === "last_name"
              ? "family-name"
              : field.name
        }
        id={field.name}
        maxLength={maxLength}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        required={required}
        type={type}
        value={field.state.value}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={field.state.meta.errors} />
      {children}
    </Field>
  )
}
