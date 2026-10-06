import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DirectorySearchField } from "./directory-search-field"

afterEach(cleanup)

type SearchHandler = (query: string | undefined) => void

function renderField({
  onSearch,
  query,
}: {
  onSearch?: SearchHandler
  query?: string
} = {}) {
  const search: SearchHandler = onSearch ?? vi.fn()
  const result = render(
    <DirectorySearchField
      label="Search users"
      onSearch={search}
      placeholder="Search"
      query={query}
    />
  )
  return { search, ...result }
}

function type(query: string) {
  const input = document.querySelector("input")
  expect(input).not.toBeNull()
  fireEvent.change(input!, { target: { value: query } })
  return input!
}

describe("DirectorySearchField", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("commits the query after the typing pause", () => {
    const { search } = renderField()

    type("avery")
    expect(search).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(search).toHaveBeenCalledWith("avery")
    expect(search).toHaveBeenCalledTimes(1)
  })

  it("commits undefined when below the minimum length", () => {
    const { search } = renderField({ query: "avery" })

    type("av")
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(search).toHaveBeenCalledWith(undefined)
  })

  it("commits immediately on Enter without waiting for the debounce", () => {
    const { search } = renderField()

    const input = type("avery")
    fireEvent.keyDown(input, { key: "Enter" })
    expect(search).toHaveBeenCalledWith("avery")

    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(search).toHaveBeenCalledTimes(1)
  })

  it("clears through the in-field action and restores focus", () => {
    const { search, getByRole } = renderField({ query: "avery" })
    const input = getByRole("searchbox", { name: "Search users" })

    fireEvent.click(getByRole("button", { name: "Clear search" }))

    expect(search).toHaveBeenCalledWith(undefined)
    expect((input as HTMLInputElement).value).toBe("")
    expect(document.activeElement).toBe(input)

    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(search).toHaveBeenCalledTimes(1)
  })

  it("does not re-commit an unchanged query", () => {
    const { search } = renderField({ query: "avery" })

    type("avery")
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(search).not.toHaveBeenCalled()
  })

  it("syncs the input when the committed query changes externally", () => {
    const search = vi.fn()
    const result = render(
      <DirectorySearchField
        label="Search users"
        onSearch={search}
        placeholder="Search"
        query="avery"
      />
    )

    result.rerender(
      <DirectorySearchField
        label="Search users"
        onSearch={search}
        placeholder="Search"
        query="morgan"
      />
    )
    act(() => {
      vi.advanceTimersByTime(250)
    })

    const input = document.querySelector("input") as HTMLInputElement
    expect(input.value).toBe("morgan")
    expect(search).not.toHaveBeenCalled()
  })
})
