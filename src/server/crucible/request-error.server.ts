import "@tanstack/react-start/server-only"

export class CrucibleResponseError extends Error {
  readonly status: number

  constructor(status: number) {
    super("The Crucible API rejected the request.")
    this.name = "CrucibleResponseError"
    this.status = status
  }
}
