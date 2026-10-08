import { describe, expect, it } from "vitest"

import { fieldErrors, shouldShowFieldError } from "./field-state"

describe("shouldShowFieldError", () => {
  it("returns false when field is valid", () => {
    expect(
      shouldShowFieldError({
        state: {
          meta: {
            errors: [],
            isBlurred: true,
            isDirty: true,
            isTouched: true,
            isValid: true,
          },
          value: "Valid entry",
        },
      })
    ).toBe(false)
  })

  it("returns false for pristine untouched field before submission", () => {
    expect(
      shouldShowFieldError({
        form: { state: { submissionAttempts: 0 } },
        state: {
          meta: {
            errors: [{ message: "Required" }],
            isBlurred: false,
            isDirty: false,
            isTouched: false,
            isValid: false,
          },
          value: "",
        },
      })
    ).toBe(false)
  })

  it("returns false when pristine field blurs without user modification (e.g. autofocus)", () => {
    expect(
      shouldShowFieldError({
        form: { state: { submissionAttempts: 0 } },
        state: {
          meta: {
            errors: [{ message: "Required" }],
            isBlurred: true,
            isDirty: false,
            isTouched: true,
            isValid: false,
          },
          value: "",
        },
      })
    ).toBe(false)
  })

  it("returns true on submission attempt even if pristine", () => {
    expect(
      shouldShowFieldError({
        form: { state: { submissionAttempts: 1 } },
        state: {
          meta: {
            errors: [{ message: "Required" }],
            isBlurred: false,
            isDirty: false,
            isTouched: false,
            isValid: false,
          },
          value: "",
        },
      })
    ).toBe(true)
  })

  it("returns true on submission attempt when isSubmitted is true", () => {
    expect(
      shouldShowFieldError({
        form: { state: { isSubmitted: true, submissionAttempts: 0 } },
        state: {
          meta: {
            errors: [{ message: "Required" }],
            isValid: false,
          },
          value: "",
        },
      })
    ).toBe(true)
  })

  it("returns true when submissionAttempts override is greater than zero", () => {
    expect(
      shouldShowFieldError(
        {
          state: {
            meta: {
              errors: [{ message: "Required" }],
              isValid: false,
            },
            value: "",
          },
        },
        1
      )
    ).toBe(true)
  })

  it("returns false while actively typing for the first time before blur", () => {
    expect(
      shouldShowFieldError({
        form: { state: { submissionAttempts: 0 } },
        state: {
          meta: {
            errors: [{ message: "Must be at least 3 characters" }],
            isBlurred: false,
            isDirty: true,
            isTouched: true,
            isValid: false,
          },
          value: "ab",
        },
      })
    ).toBe(false)
  })

  it("returns true when dirty field blurs with invalid content", () => {
    expect(
      shouldShowFieldError({
        form: { state: { submissionAttempts: 0 } },
        state: {
          meta: {
            errors: [{ message: "Must be at least 3 characters" }],
            isBlurred: true,
            isDirty: true,
            isTouched: true,
            isValid: false,
          },
          value: "ab",
        },
      })
    ).toBe(true)
  })

  it("returns true when user clears a field (making it empty)", () => {
    expect(
      shouldShowFieldError({
        form: { state: { submissionAttempts: 0 } },
        state: {
          meta: {
            errors: [{ message: "Required" }],
            isBlurred: false,
            isDirty: true,
            isTouched: true,
            isValid: false,
          },
          value: "",
        },
      })
    ).toBe(true)

    expect(
      shouldShowFieldError({
        form: { state: { submissionAttempts: 0 } },
        state: {
          meta: {
            errors: [{ message: "Required" }],
            isBlurred: false,
            isDirty: true,
            isTouched: true,
            isValid: false,
          },
          value: "   ",
        },
      })
    ).toBe(true)

    expect(
      shouldShowFieldError({
        form: { state: { submissionAttempts: 0 } },
        state: {
          meta: {
            errors: [{ message: "Required" }],
            isBlurred: false,
            isDirty: true,
            isTouched: true,
            isValid: false,
          },
          value: null,
        },
      })
    ).toBe(true)
  })
})

describe("fieldErrors", () => {
  const invalidField = {
    form: { state: { submissionAttempts: 1 } },
    state: {
      meta: {
        errors: [{ message: "Enter a title" }],
        isValid: false,
      },
      value: "",
    },
  }

  const validField = {
    form: { state: { submissionAttempts: 0 } },
    state: {
      meta: {
        errors: [],
        isValid: true,
      },
      value: "Good",
    },
  }

  it("returns empty array when field should not show errors", () => {
    expect(fieldErrors(validField)).toEqual([])
  })

  it("returns errors when field should show errors", () => {
    expect(fieldErrors(invalidField)).toEqual([{ message: "Enter a title" }])
  })

  it("includes extraErrors when invalid", () => {
    expect(
      fieldErrors(invalidField, {
        extraErrors: [{ message: "Already taken" }],
      })
    ).toEqual([{ message: "Already taken" }, { message: "Enter a title" }])
  })

  it("forces errors display when invalid option is true", () => {
    const pristineField = {
      form: { state: { submissionAttempts: 0 } },
      state: {
        meta: {
          errors: [{ message: "Pristine error" }],
          isDirty: false,
          isValid: false,
        },
        value: "",
      },
    }
    expect(fieldErrors(pristineField, { invalid: true })).toEqual([
      { message: "Pristine error" },
    ])
  })
})
