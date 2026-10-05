import { z } from "zod"

export const PROJECT_ID_MAX_LENGTH = 25
export const INSTRUMENT_ID_MAX_LENGTH = 25
export const USERNAME_MAX_LENGTH = 24

export const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,24}$/
export const INSTRUMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,24}$/
export const USERNAME_PATTERN = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/

export const RESERVED_PROJECT_IDS = new Set(["admin", "public", "read_only"])

export const projectIdSchema = z
  .string()
  .trim()
  .regex(
    PROJECT_ID_PATTERN,
    "Use 3 to 25 letters, numbers, underscores, or hyphens, starting with a letter or number."
  )
  .refine(
    (value) => !RESERVED_PROJECT_IDS.has(value.toLocaleLowerCase()),
    "This project ID is reserved."
  )

export const instrumentIdSchema = z
  .string()
  .trim()
  .regex(
    INSTRUMENT_ID_PATTERN,
    "Use 3 to 25 letters, numbers, underscores, or hyphens, starting with a letter or number."
  )

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Use at least 3 characters for username.")
  .max(USERNAME_MAX_LENGTH, "Use 24 characters or fewer for username.")
  .regex(
    USERNAME_PATTERN,
    "Start with a lowercase letter and use lowercase letters, numbers, hyphens, or underscores."
  )
