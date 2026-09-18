import "@tanstack/react-start/server-only"

export class CrucibleResponseError extends Error {
  readonly status: number

  constructor(status: number) {
    super("The Crucible API rejected the request.")
    this.name = "CrucibleResponseError"
    this.status = status
  }
}

export class CrucibleContractError extends Error {
  readonly contract: string
  readonly issues: readonly { code: string; path: string }[]

  constructor(
    contract: string,
    issues: readonly { code: string; path: PropertyKey[] }[]
  ) {
    super("The Crucible API response did not match its contract.")
    this.name = "CrucibleContractError"
    this.contract = contract
    this.issues = issues.map((issue) => ({
      code: issue.code,
      path: issue.path.map(String).join("."),
    }))
  }
}
