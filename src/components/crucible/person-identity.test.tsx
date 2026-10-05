import type { AnchorHTMLAttributes, ReactNode } from "react"
import { forwardRef } from "react"
import type * as TanStackReactRouter from "@tanstack/react-router"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PersonIdentity } from "./person-identity"
import { PersonLink } from "./person-link"
import { ResourceOwnerCell } from "./resource-collection-cells"
import { Table, TableBody, TableRow } from "@/components/ui/table"

type MockLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: ReactNode
  params?: { personId?: string }
  to?: string
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return {
    ...actual,
    Link: forwardRef<HTMLAnchorElement, MockLinkProps>(function MockLink(
      { children, className, params, to, ...props },
      ref
    ) {
      const href = to ? to.replace("$personId", params?.personId ?? "") : "#"
      return (
        <a ref={ref} className={className} href={href} {...props}>
          {children}
        </a>
      )
    }),
  }
})

const testPerson = {
  first_name: "Jane",
  last_name: "Doe",
  unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z3",
  username: "jdoe",
}

describe("PersonIdentity", () => {
  afterEach(cleanup)

  it("renders collection presentation with truncation classes", () => {
    const { container } = render(
      <PersonIdentity person={testPerson} presentation="collection" />
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain("block")
    expect(element.className).toContain("min-w-0")
    expect(element.className).toContain("truncate")
    expect(element.className).toContain("[&>*]:block")
    expect(element.className).toContain("[&>*]:truncate")
    expect(element.getAttribute("title")).toBe("Jane Doe")
    expect(element.textContent).toBe("Jane Doe")
  })

  it("suppresses title tooltip in collection presentation when nameContent is supplied", () => {
    const { container } = render(
      <PersonIdentity
        nameContent={<span>Custom Content</span>}
        person={testPerson}
        presentation="collection"
      />
    )
    const element = container.firstChild as HTMLElement
    expect(element.getAttribute("title")).toBeNull()
    expect(element.textContent).toBe("Custom Content")
  })

  it("renders inline presentation with break-words", () => {
    const { container } = render(
      <PersonIdentity person={testPerson} presentation="inline" />
    )
    const element = container.firstChild as HTMLElement
    expect(element.className).toContain("break-words")
    expect(element.className).not.toContain("truncate")
  })
})

describe("PersonLink", () => {
  afterEach(cleanup)

  it("renders collection presentation with block truncate on the link", () => {
    render(
      <PersonLink
        nameStyle="abbreviated"
        person={testPerson}
        presentation="collection"
      />
    )
    const link = screen.getByRole("link", { name: "J. Doe" })
    expect(link.className).toContain("block")
    expect(link.className).toContain("truncate")
  })

  it("renders default presentation with inline-block on the link", () => {
    render(<PersonLink nameStyle="abbreviated" person={testPerson} />)
    const link = screen.getByRole("link", { name: "J. Doe" })
    expect(link.className).toContain("inline-block")
    expect(link.className).not.toContain("block truncate")
  })
})

describe("ResourceOwnerCell", () => {
  afterEach(cleanup)

  it("renders PersonLink with collection presentation when owner is provided", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <ResourceOwnerCell owner={testPerson} />
          </TableRow>
        </TableBody>
      </Table>
    )
    const link = screen.getByRole("link", { name: "J. Doe" })
    expect(link.className).toContain("block")
    expect(link.className).toContain("truncate")
  })

  it("renders truncated fallback when owner is absent", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <ResourceOwnerCell username="fallback-user" />
          </TableRow>
        </TableBody>
      </Table>
    )
    const fallback = container.querySelector("td > span")
    expect(fallback?.className).toContain("block")
    expect(fallback?.className).toContain("truncate")
    expect(fallback?.textContent).toBe("fallback-user")
  })
})
