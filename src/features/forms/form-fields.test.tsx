import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { z } from "zod"

import { useAppForm } from "./app-form"

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  notes: z.string().max(5, "Use 5 characters or fewer."),
})

function TestForm({ description }: { description?: string }) {
  const form = useAppForm({
    defaultValues: { name: "", notes: "" },
    validators: { onChange: schema },
  })
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.AppField name="name">
        {(field) => (
          <field.TextField
            description={description}
            label="Name"
            maxLength={20}
            required
          />
        )}
      </form.AppField>
      <form.AppField name="notes">
        {(field) => <field.TextAreaField label="Notes" />}
      </form.AppField>
      <button type="submit">Save</button>
    </form>
  )
}

describe("shared form fields", () => {
  afterEach(cleanup)

  it("describes the control with its description", () => {
    render(<TestForm description="Shown on the project page." />)
    const name = screen.getByRole("textbox", { name: /Name/ })
    expect(name.getAttribute("aria-describedby")).toBe("name-description")
    expect(document.getElementById("name-description")!.textContent).toBe(
      "Shown on the project page."
    )
    expect(name.getAttribute("aria-invalid")).toBeNull()
  })

  it("links the error to the control once the form is submitted", async () => {
    render(<TestForm description="Shown on the project page." />)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    const error = await screen.findByText("Enter a name.")
    const name = screen.getByRole("textbox", { name: /Name/ })
    expect(name.getAttribute("aria-invalid")).toBe("true")
    expect(name.getAttribute("aria-errormessage")).toBe("name-error")
    expect(name.getAttribute("aria-describedby")).toBe(
      "name-description name-error"
    )
    expect(error.closest("#name-error")).not.toBeNull()
  })
})
