import { createFormHook } from "@tanstack/react-form"

import { fieldContext, formContext } from "@/features/forms/form-context"
import { TextAreaField, TextField } from "@/features/forms/form-fields"

export const { useAppForm } = createFormHook({
  fieldComponents: { TextAreaField, TextField },
  fieldContext,
  formComponents: {},
  formContext,
})
