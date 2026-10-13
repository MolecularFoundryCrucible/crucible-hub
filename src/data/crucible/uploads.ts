import type { IHasher } from "hash-wasm"
import { createCRC32, createSHA256 } from "hash-wasm"

import { HubApiClientError } from "./result"

export const UPLOAD_PART_SIZE = 64 * 1024 * 1024
export const MAX_UPLOAD_SIZE = 500 * 1024 * 1024 * 1024
export const MAX_UPLOAD_PART_NUMBER = Math.ceil(
  MAX_UPLOAD_SIZE / UPLOAD_PART_SIZE
)
export const MAX_CONCURRENT_PARTS = 8
export const MAX_PARTS_PER_SIGN_REQUEST = 64

export const CRC32C_POLYNOMIAL = 0x82f63b78
const READ_CHUNK_SIZE = 8 * 1024 * 1024
const SIGN_WINDOW_PARTS = MAX_CONCURRENT_PARTS * 4
const MAX_PART_ATTEMPTS = 3
const DEFAULT_PART_RETRY_WAIT_MS = 1000
const MAX_PART_RETRY_WAIT_MS = 60_000

export type UploadPart = {
  partNumber: number
  start: number
  end: number
}

export type UploadPartSignature = {
  partNumber: number
  crc32cBase64: string
}

export type UploadFileDigests = {
  sha256Hex: string
  crc32cBase64: string
  partCrc32cBase64: string[]
}

export class UploadSizeError extends Error {
  constructor() {
    super(
      `Files larger than ${MAX_UPLOAD_SIZE / 1024 ** 3} GiB are not supported.`
    )
    this.name = "UploadSizeError"
  }
}

export class UploadPartError extends Error {
  constructor(
    readonly partNumber: number,
    readonly retryAfterSeconds?: number
  ) {
    super(`Part ${partNumber} could not be transferred.`)
    this.name = "UploadPartError"
  }
}

export function planUploadParts(
  fileSize: number,
  partSize = UPLOAD_PART_SIZE
): UploadPart[] {
  if (!Number.isInteger(fileSize) || fileSize < 0) {
    throw new Error("The upload size must be a non-negative integer.")
  }
  if (!Number.isInteger(partSize) || partSize <= 0) {
    throw new Error("The upload part size must be a positive integer.")
  }
  if (fileSize > MAX_UPLOAD_SIZE) {
    throw new UploadSizeError()
  }
  const parts: UploadPart[] = []
  let start = 0
  let partNumber = 1
  while (start < fileSize) {
    const end = Math.min(start + partSize, fileSize)
    parts.push({ partNumber, start, end })
    partNumber += 1
    start = end
  }
  return parts
}

export function validateUploadFilename(filename: string): readonly string[] {
  if (filename.length === 0) {
    return ["Enter a file name."]
  }
  const issues: string[] = []
  if (filename.includes("\\")) {
    issues.push("File names must not contain backslashes.")
  }
  if (/[\p{Cc}]/u.test(filename)) {
    issues.push("File names must not contain control characters.")
  }
  if (filename.startsWith("/")) {
    issues.push("File names must be relative paths.")
  }
  const segments = filename.split("/")
  if (segments.some((segment) => segment.length === 0)) {
    issues.push("File names must not contain empty path segments.")
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    issues.push("File names must not contain dot path segments.")
  }
  return issues
}

export async function computeUploadDigests(
  file: Blob,
  parts: readonly UploadPart[],
  onProgress?: (hashedBytes: number) => void,
  signal?: AbortSignal,
  onPartDigest?: (partNumber: number, crc32cBase64: string) => void
): Promise<UploadFileDigests> {
  const lastPart = parts.at(-1)
  const tilesFile =
    file.size === 0
      ? parts.length === 0
      : parts.length > 0 &&
        parts[0].start === 0 &&
        lastPart !== undefined &&
        lastPart.end === file.size
  if (!tilesFile) {
    throw new Error("Upload parts do not tile the file.")
  }

  const sha256 = await createSHA256()
  const wholeCrc32c = await createCRC32(CRC32C_POLYNOMIAL)
  sha256.init()
  wholeCrc32c.init()
  const partCrc32cBase64: string[] = []
  let partHasher: IHasher | undefined
  let partIndex = 0
  let offset = 0

  while (offset < file.size) {
    signal?.throwIfAborted()
    const bytes = new Uint8Array(
      await file
        .slice(offset, Math.min(offset + READ_CHUNK_SIZE, file.size))
        .arrayBuffer()
    )
    sha256.update(bytes)
    wholeCrc32c.update(bytes)
    let chunkOffset = 0
    while (chunkOffset < bytes.length) {
      if (partIndex >= parts.length) {
        throw new Error("Upload parts do not tile the file.")
      }
      const part = parts[partIndex]
      if (partHasher === undefined) {
        partHasher = await createCRC32(CRC32C_POLYNOMIAL)
        partHasher.init()
      }
      const take = Math.min(
        bytes.length - chunkOffset,
        part.end - (offset + chunkOffset)
      )
      partHasher.update(bytes.subarray(chunkOffset, chunkOffset + take))
      chunkOffset += take
      if (offset + chunkOffset === part.end) {
        const digest = encodeBase64(partHasher.digest("binary"))
        partCrc32cBase64.push(digest)
        onPartDigest?.(part.partNumber, digest)
        partIndex += 1
        partHasher = undefined
      }
    }
    offset += bytes.length
    onProgress?.(offset)
  }

  return {
    sha256Hex: sha256.digest("hex"),
    crc32cBase64: encodeBase64(wholeCrc32c.digest("binary")),
    partCrc32cBase64,
  }
}

export type UploadPartChecksums = {
  ready: (partNumber: number) => string | undefined
  wait: (partNumber: number) => Promise<string>
}

export function createUploadPartChecksums() {
  const values = new Map<number, string>()
  const waiters = new Map<number, ((value: string) => void)[]>()
  let failure: { error: unknown } | undefined
  const rejecters = new Set<(error: unknown) => void>()

  return {
    ready: (partNumber: number) => values.get(partNumber),
    wait: (partNumber: number) => {
      const value = values.get(partNumber)
      if (value !== undefined) return Promise.resolve(value)
      if (failure) return Promise.reject(failure.error)
      return new Promise<string>((resolve, reject) => {
        waiters.set(partNumber, [...(waiters.get(partNumber) ?? []), resolve])
        rejecters.add(reject)
      })
    },
    resolve: (partNumber: number, value: string) => {
      values.set(partNumber, value)
      for (const resolve of waiters.get(partNumber) ?? []) resolve(value)
      waiters.delete(partNumber)
    },
    fail: (error: unknown) => {
      failure = { error }
      for (const reject of rejecters) reject(error)
      rejecters.clear()
      waiters.clear()
    },
  }
}

function knownChecksums(signatures: readonly string[]): UploadPartChecksums {
  return {
    ready: (partNumber) => signatures.at(partNumber - 1),
    wait: (partNumber) => {
      const value = signatures.at(partNumber - 1)
      return value === undefined
        ? Promise.reject(new Error(`Part ${partNumber} has no checksum.`))
        : Promise.resolve(value)
    },
  }
}

export type SignedUploadPart = {
  headers: Readonly<Record<string, string>>
  url: string
}

export type UploadPartTransport = {
  readAcknowledgedPartNumbers: () => Promise<ReadonlySet<number>>
  signParts: (
    parts: readonly UploadPartSignature[]
  ) => Promise<ReadonlyMap<number, SignedUploadPart>>
  putPart: (
    part: UploadPart,
    signed: SignedUploadPart,
    body: Blob,
    signal?: AbortSignal,
    onProgress?: (loadedBytes: number) => void
  ) => Promise<void>
}

export type RunUploadPartsOptions = {
  file: Blob
  parts: readonly UploadPart[]
  signatures: readonly string[] | UploadPartChecksums
  transport: UploadPartTransport
  signal?: AbortSignal
  maxConcurrentParts?: number
  signWindowParts?: number
  maxPartAttempts?: number
  wait?: (milliseconds: number) => Promise<void>
  onPartUploaded?: (partNumber: number) => void
  onPartProgress?: (partNumber: number, loadedBytes: number) => void
}

export async function runUploadParts(
  options: RunUploadPartsOptions
): Promise<void> {
  const {
    file,
    parts,
    signatures,
    transport,
    signal,
    maxConcurrentParts = MAX_CONCURRENT_PARTS,
    signWindowParts = SIGN_WINDOW_PARTS,
    maxPartAttempts = MAX_PART_ATTEMPTS,
    wait = defaultWait,
    onPartUploaded,
    onPartProgress,
  } = options
  const checksums = Array.isArray(signatures)
    ? knownChecksums(signatures)
    : (signatures as UploadPartChecksums)
  const signWindow = Math.min(signWindowParts, MAX_PARTS_PER_SIGN_REQUEST)
  const laneLimit = Math.max(
    1,
    Math.min(maxConcurrentParts, MAX_CONCURRENT_PARTS)
  )

  const acknowledged = await transport.readAcknowledgedPartNumbers()
  const pending = parts.filter((part) => !acknowledged.has(part.partNumber))

  let index = 0
  while (index < pending.length) {
    const required = Math.min(laneLimit, signWindow, pending.length - index)
    await Promise.all(
      pending
        .slice(index, index + required)
        .map((part) => checksums.wait(part.partNumber))
    )
    assertNotAborted(signal)
    let end = index + required
    while (
      end < pending.length &&
      end - index < signWindow &&
      checksums.ready(pending[end].partNumber) !== undefined
    ) {
      end += 1
    }
    await uploadWindow({
      file,
      window: pending.slice(index, end),
      checksums,
      transport,
      signal,
      laneLimit,
      maxPartAttempts,
      wait,
      onPartUploaded,
      onPartProgress,
    })
    index = end
  }
}

type UploadWindowOptions = {
  file: Blob
  window: UploadPart[]
  checksums: UploadPartChecksums
  transport: UploadPartTransport
  signal?: AbortSignal
  laneLimit: number
  maxPartAttempts: number
  wait: (milliseconds: number) => Promise<void>
  onPartUploaded?: (partNumber: number) => void
  onPartProgress?: (partNumber: number, loadedBytes: number) => void
}

async function uploadWindow(options: UploadWindowOptions): Promise<void> {
  const {
    file,
    window,
    checksums,
    transport,
    signal,
    laneLimit,
    maxPartAttempts,
    wait,
    onPartUploaded,
    onPartProgress,
  } = options
  let remaining = window
  let lastError: unknown
  let failedAttempts = 0

  for (;;) {
    assertNotAborted(signal)
    const outstanding = remaining.length
    try {
      const urls = await transport.signParts(
        remaining.map((part) => ({
          partNumber: part.partNumber,
          crc32cBase64: checksums.ready(part.partNumber) ?? "",
        }))
      )
      // Signed URLs are bearer credentials: this window-local map is never returned, logged, or persisted.
      const result = await attemptParts(remaining, laneLimit, async (part) => {
        const signed = urls.get(part.partNumber)
        if (signed === undefined) {
          throw new Error("The upload session did not sign a requested part.")
        }
        try {
          await transport.putPart(
            part,
            signed,
            file.slice(part.start, part.end),
            signal,
            (loaded) => onPartProgress?.(part.partNumber, loaded)
          )
        } catch (error) {
          onPartProgress?.(part.partNumber, 0)
          throw error
        }
        onPartUploaded?.(part.partNumber)
      })
      remaining = result.failed
      lastError = result.lastError
    } catch (error) {
      lastError = error
    }
    if (remaining.length === 0) {
      return
    }
    assertNotAborted(signal)
    if (
      lastError instanceof HubApiClientError &&
      !lastError.details.retryable
    ) {
      throw lastError
    }
    failedAttempts = remaining.length < outstanding ? 1 : failedAttempts + 1
    if (failedAttempts >= maxPartAttempts) {
      throw lastError ?? new Error("The upload could not transfer all parts.")
    }
    await wait(retryWaitMilliseconds(lastError, failedAttempts))
  }
}

type PartAttemptResult = {
  failed: UploadPart[]
  lastError: unknown
}

async function attemptParts(
  parts: readonly UploadPart[],
  limit: number,
  worker: (part: UploadPart) => Promise<void>
): Promise<PartAttemptResult> {
  const failed: UploadPart[] = []
  let lastError: unknown
  let nextIndex = 0

  await Promise.all(
    Array.from({ length: Math.min(limit, parts.length) }, async () => {
      while (nextIndex < parts.length) {
        const part = parts[nextIndex]
        nextIndex += 1
        try {
          await worker(part)
        } catch (error) {
          const wrapped =
            error instanceof UploadPartError
              ? error
              : new UploadPartError(
                  part.partNumber,
                  readErrorRetryAfterSeconds(error)
                )
          failed.push(part)
          if (
            lastError === undefined ||
            (wrapped.retryAfterSeconds !== undefined &&
              readErrorRetryAfterSeconds(lastError) === undefined)
          ) {
            lastError = wrapped
          }
        }
      }
    })
  )

  return { failed, lastError }
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw (
      signal.reason ??
      new DOMException("The upload was cancelled.", "AbortError")
    )
  }
}

function readErrorRetryAfterSeconds(error: unknown): number | undefined {
  const seconds: unknown =
    error instanceof HubApiClientError
      ? error.details.retryAfterSeconds
      : error instanceof Error
        ? (error as { retryAfterSeconds?: unknown }).retryAfterSeconds
        : undefined
  return typeof seconds === "number" &&
    Number.isSafeInteger(seconds) &&
    seconds >= 0
    ? seconds
    : undefined
}

function retryWaitMilliseconds(error: unknown, attempt: number): number {
  const seconds = readErrorRetryAfterSeconds(error)
  if (seconds !== undefined) {
    return seconds * 1000
  }
  return Math.min(DEFAULT_PART_RETRY_WAIT_MS * attempt, MAX_PART_RETRY_WAIT_MS)
}

function defaultWait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}
