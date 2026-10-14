import "@tanstack/react-start/server-only"

export type HubSessionBackend = {
  set: (key: string, value: string, lifetimeMs: number) => Promise<void>
  get: (key: string) => Promise<string | null>
  take: (key: string) => Promise<string | null>
  compareAndSet: (
    key: string,
    expected: string,
    value: string,
    lifetimeMs: number
  ) => Promise<boolean>
  move: (
    key: string,
    nextKey: string,
    expected: string,
    value: string,
    lifetimeMs: number
  ) => Promise<boolean>
  cancelLogin: (
    cancelKey: string,
    transactionKey: string,
    lifetimeMs: number
  ) => Promise<void>
  issueAfterLogin: (input: {
    cancelKey: string
    sessionKey: string
    previousKey: string
    issuedKey: string
    value: string
    lifetimeMs: number
    issuedLifetimeMs: number
  }) => Promise<boolean>
}
