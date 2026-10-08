export interface FormFieldLike {
  form?: {
    state?: {
      isSubmitted?: boolean
      submissionAttempts?: number
    }
  }
  state: {
    meta: {
      errors?: Array<{ message?: string } | undefined>
      isBlurred?: boolean
      isDirty?: boolean
      isTouched?: boolean
      isValid?: boolean
    }
    value?: unknown
  }
}

export function shouldShowFieldError(
  field: FormFieldLike,
  submissionAttemptsOverride?: number
): boolean {
  const { meta } = field.state
  const hasErrors = Boolean(meta.errors && meta.errors.length > 0)
  const isInvalid = meta.isValid !== undefined ? !meta.isValid : hasErrors
  if (!isInvalid) {
    return false
  }

  const hasAttemptedSubmit =
    submissionAttemptsOverride !== undefined
      ? submissionAttemptsOverride > 0
      : (field.form?.state?.submissionAttempts ?? 0) > 0 ||
        Boolean(field.form?.state?.isSubmitted)

  if (hasAttemptedSubmit) {
    return true
  }

  if (meta.isDirty) {
    if (meta.isBlurred) {
      return true
    }
    const val = field.state.value
    const isEmpty =
      val === "" ||
      val === null ||
      val === undefined ||
      (typeof val === "string" && val.trim() === "")
    if (isEmpty) {
      return true
    }
  }

  return false
}

export function fieldErrors(
  field: FormFieldLike,
  options?: {
    extraErrors?: Array<{ message?: string } | undefined>
    invalid?: boolean
    submissionAttempts?: number
  }
): Array<{ message?: string } | undefined> {
  const show =
    options?.invalid || shouldShowFieldError(field, options?.submissionAttempts)
  if (!show) {
    return []
  }
  const baseErrors = field.state.meta.errors ?? []
  if (options?.extraErrors?.length) {
    return [...options.extraErrors, ...baseErrors]
  }
  return baseErrors
}
