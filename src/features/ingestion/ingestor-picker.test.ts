import { describe, expect, it } from "vitest"

import { suggestedIngestors } from "./ingestor-picker"

describe("suggestedIngestors", () => {
  it("suggests ingestors whose extensions end a file name, without case", () => {
    const ingestors = [
      {
        description: null,
        fileExtensions: [".tar.gz"],
        name: "ArchiveIngestor",
      },
      { description: null, fileExtensions: [".mrc"], name: "MrcIngestor" },
      { description: null, fileExtensions: [], name: "H5Ingestor" },
    ]

    expect([
      ...suggestedIngestors(ingestors, ["Run.TAR.GZ", "map.mrc.txt"]),
    ]).toEqual(["ArchiveIngestor"])
  })
})
