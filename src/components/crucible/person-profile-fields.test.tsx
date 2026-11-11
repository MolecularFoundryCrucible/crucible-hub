import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { PersonProfileFields } from "./person-profile-fields"

const person = {
  first_name: "Morgan",
  last_name: "Lee",
  unique_id: "0000-0000-0000-0018",
  username: "morgan.lee",
}

describe("PersonProfileFields", () => {
  afterEach(cleanup)

  it("shows name, username and only the rows it is given", () => {
    render(<PersonProfileFields email="morgan@example.org" person={person} />)

    expect(screen.getByText("Morgan Lee")).toBeTruthy()
    expect(screen.getByText("morgan.lee")).toBeTruthy()
    expect(screen.getByText("morgan@example.org")).toBeTruthy()
    expect(screen.getByText("Crucible ID")).toBeTruthy()
    expect(screen.queryByText("Platform role")).toBeNull()
    expect(screen.queryByText("Last active")).toBeNull()
  })

  it("marks a given but empty value as not provided", () => {
    render(
      <PersonProfileFields
        email={null}
        person={{ ...person, username: null }}
        platformRole={null}
      />
    )

    expect(screen.getAllByText("Not provided")).toHaveLength(2)
    expect(screen.getByText("No platform role")).toBeTruthy()
  })

  it("hides an empty name and username on a public profile", () => {
    render(
      <PersonProfileFields
        hideMissing
        person={{ unique_id: person.unique_id }}
      />
    )

    expect(screen.queryByText("Name")).toBeNull()
    expect(screen.queryByText("Username")).toBeNull()
    expect(screen.queryByText("Not provided")).toBeNull()
  })
})
