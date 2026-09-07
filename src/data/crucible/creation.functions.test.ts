import { describe, expect, it } from "vitest"

import {
  datasetCreateInputSchema,
  projectCreateInputSchema,
  sampleCreateInputSchema,
} from "./creation.functions"

describe("creation server inputs", () => {
  it("accepts normalized project creation fields", () => {
    expect(
      projectCreateInputSchema.parse({
        project: {
          organization: " Molecular Foundry ",
          project_id: " perovskite-1 ",
          project_lead: " person-mfid ",
          title: " Perovskite study ",
        },
      })
    ).toEqual({
      project: {
        organization: "Molecular Foundry",
        project_id: "perovskite-1",
        project_lead: "person-mfid",
        title: "Perovskite study",
      },
    })
  })

  it.each(["ab", "project id", "read_only", "public", "admin"])(
    "rejects invalid or reserved project ID %s",
    (projectId) => {
      expect(() =>
        projectCreateInputSchema.parse({
          project: {
            organization: "Foundry",
            project_id: projectId,
            project_lead: "person-mfid",
            title: "Study",
          },
        })
      ).toThrow()
    }
  )

  it("omits client-assigned identifiers from sample creation", () => {
    expect(
      sampleCreateInputSchema.parse({
        sample: {
          description: null,
          projectMfid: "project-mfid",
          public: false,
          sample_name: "Sample A",
          sample_type: null,
          timestamp: "2026-09-06T19:20:00.000Z",
        },
      }).sample
    ).toEqual({
      description: null,
      projectMfid: "project-mfid",
      public: false,
      sample_name: "Sample A",
      sample_type: null,
      timestamp: "2026-09-06T19:20:00.000Z",
    })
    expect(() =>
      sampleCreateInputSchema.parse({
        sample: {
          description: null,
          projectMfid: "project-mfid",
          public: false,
          sample_name: "Sample A",
          sample_type: null,
          timestamp: null,
          unique_id: "client-assigned-mfid",
        },
      })
    ).toThrow()
  })

  it("accepts an optional instrument for dataset creation", () => {
    expect(
      datasetCreateInputSchema.parse({
        dataset: {
          data_format: null,
          data_type: null,
          dataset_name: "Dataset A",
          instrumentMfid: null,
          measurement: null,
          projectMfid: "project-mfid",
          public: false,
          session_name: null,
          timestamp: null,
        },
      }).dataset.instrumentMfid
    ).toBeNull()

    expect(() =>
      datasetCreateInputSchema.parse({
        dataset: {
          data_format: null,
          data_type: null,
          dataset_name: "Dataset A",
          instrumentMfid: null,
          measurement: null,
          projectMfid: "project-mfid",
          public: false,
          session_name: null,
          timestamp: null,
          unique_id: "client-assigned-mfid",
        },
      })
    ).toThrow()
  })
})
