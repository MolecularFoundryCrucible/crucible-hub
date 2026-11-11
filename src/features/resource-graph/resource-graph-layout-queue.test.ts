import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  LayoutSupersededError,
  createLayoutQueue,
} from "./resource-graph-layout-queue"

type Deferred = {
  promise: Promise<string>
  reject: (error: unknown) => void
  resolve: (value: string) => void
}

function deferred(): Deferred {
  let resolve!: (value: string) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<string>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, reject, resolve }
}

function fakeEngine() {
  const runs: { input: string; result: Deferred }[] = []
  return {
    layout: vi.fn((input: string) => {
      const result = deferred()
      runs.push({ input, result })
      return result.promise
    }),
    runs,
  }
}

describe("createLayoutQueue", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("runs one layout at a time and replaces a waiting one", async () => {
    const engine = fakeEngine()
    const queue = createLayoutQueue({
      engine: () => engine,
      layout: (current, input: string) => current.layout(input),
      onFailure: vi.fn(),
      timeoutMs: 6000,
    })

    const first = queue.run("first")
    const replaced = expect(queue.run("second")).rejects.toBeInstanceOf(
      LayoutSupersededError
    )
    const third = queue.run("third")
    await vi.advanceTimersByTimeAsync(0)

    expect(engine.runs.map((run) => run.input)).toEqual(["first"])
    await replaced

    engine.runs[0].result.resolve("first done")
    await expect(first).resolves.toBe("first done")
    await vi.advanceTimersByTimeAsync(0)
    expect(engine.runs.map((run) => run.input)).toEqual(["first", "third"])
    engine.runs[1].result.resolve("third done")
    await expect(third).resolves.toBe("third done")
    expect(queue.idle()).toBe(true)
  })

  it("starts the timeout when a layout starts, not while it waits", async () => {
    const engine = fakeEngine()
    const onFailure = vi.fn()
    const queue = createLayoutQueue({
      engine: () => engine,
      layout: (current, input: string) => current.layout(input),
      onFailure,
      timeoutMs: 6000,
    })

    const first = queue.run("first")
    const second = queue.run("second")
    await vi.advanceTimersByTimeAsync(5000)
    engine.runs[0].result.resolve("first done")
    await expect(first).resolves.toBe("first done")

    await vi.advanceTimersByTimeAsync(5000)
    expect(onFailure).not.toHaveBeenCalled()
    engine.runs[1].result.resolve("second done")
    await expect(second).resolves.toBe("second done")
  })

  it("rejects a layout that runs too long and reports its engine", async () => {
    const engine = fakeEngine()
    const onFailure = vi.fn()
    const queue = createLayoutQueue({
      engine: () => engine,
      layout: (current, input: string) => current.layout(input),
      onFailure,
      timeoutMs: 6000,
    })

    const slow = queue.run("slow")
    const expectation = expect(slow).rejects.toThrow("timed out")
    await vi.advanceTimersByTimeAsync(6000)
    await expectation
    expect(onFailure).toHaveBeenCalledWith(engine)
  })

  it("keeps going after an engine that throws", async () => {
    const queue = createLayoutQueue({
      engine: () => null,
      layout: (): Promise<string> => {
        throw new Error("worker unavailable")
      },
      onFailure: vi.fn(),
      timeoutMs: 6000,
    })

    await expect(queue.run("broken")).rejects.toThrow("worker unavailable")
    expect(queue.idle()).toBe(true)
  })
})
