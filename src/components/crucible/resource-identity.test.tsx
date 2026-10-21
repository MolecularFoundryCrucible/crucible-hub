import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ResourceIdentity } from "./resource-identity"

afterEach(cleanup)

describe("ResourceIdentity", () => {
  it("labels an instrument identifier with the instrument icon", () => {
    const { container } = render(
      <ResourceIdentity
        instrumentId="hard-xray-microprobe"
        kind="instrument"
        name="Hard X-ray Microprobe"
        presentation="collection"
      />
    )
    const context = container.querySelector("[data-resource-context]")

    expect(context?.textContent).toBe("Instrument ID:hard-xray-microprobe")
    expect(
      context?.querySelector("[data-resource-type='instrument']")
    ).toBeTruthy()
  })
})
