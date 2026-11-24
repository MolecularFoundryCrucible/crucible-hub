import { createFormHook } from "@tanstack/react-form"

import { fieldContext, formContext } from "@/components/forms/form-context"
import { TextAreaField, TextField } from "@/components/forms/form-fields"

export const { useAppForm } = createFormHook({
  fieldComponents: { TextAreaField, TextField },
  fieldContext,
  formComponents: {},
  formContext,
})
