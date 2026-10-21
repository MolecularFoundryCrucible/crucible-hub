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

  it("pairs the name icon with label text and secondary icons with supporting text", () => {
    const { container } = render(
      <ResourceIdentity
        kind="sample"
        mfid="01J6Y8N4Q2R7M9K3T5V0W1X2Z9"
        name="NiFe oxide catalyst A"
        presentation="collection"
        projectId="operando-catalyst-mapping"
      />
    )
    const icons = [...container.querySelectorAll("svg")]

    expect(
      icons.map((icon) => icon.classList.contains("size-icon-label"))
    ).toEqual([true, false, false])
    expect(
      icons.map((icon) => icon.classList.contains("size-icon-supporting"))
    ).toEqual([false, true, true])
  })
})
