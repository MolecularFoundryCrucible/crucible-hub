import type { components } from "@/generated/crucible-api"
import {
  demoWorkspace,
  publicOnlyDatasets,
  publicOnlySamples,
} from "@/data/crucible/fixtures/demo-workspace"
import { defaultFixtureScenario } from "@/data/crucible/fixture-scenarios"
import type { FixtureScenario } from "@/data/crucible/fixture-scenarios"
import type {
  Workspace,
  WorkspaceSource,
} from "@/data/crucible/workspace-source"
import {
  readUploadIngestionEnabled,
  readAccountPreferencesEnabled,
  readUploadsEnabled,
} from "./workspace-config.server"
import type { WorkspacePrivilegeMode } from "./privilege-mode"

type ApiLinkedResource = components["schemas"]["LinkedResource"]

const densePrimaryInstrument = {
  instrument_id: "dense-instrument-1",
  instrument_name: "High-resolution operando hard X-ray microprobe instrument",
  unique_id: "fixture-instrument-1",
}

const denseSecondaryInstrument = {
  instrument_id: "dense-instrument-2",
  instrument_name: "Research instrument 2",
  unique_id: "fixture-instrument-2",
}

const denseSampleOneLinks = [
  {
    name: "Catalyst sample 2",
    direction: "source",
    relationship_type: null,
    resource_type: "sample",
    unique_id: "fixture-sample-2",
  },
  {
    name: null,
    direction: "target",
    relationship_type: null,
    resource_type: "sample",
    unique_id: "fixture-sample-3",
  },
  {
    name: "Operando spectroscopy acquisition",
    direction: "undirected",
    relationship_type: null,
    resource_type: "dataset",
    unique_id: "fixture-dataset-1",
  },
] satisfies readonly ApiLinkedResource[]

const denseSampleTwoLinks = [
  {
    name: "Nickel iron oxide catalyst",
    direction: "target",
    relationship_type: null,
    resource_type: "sample",
    unique_id: "fixture-sample-1",
  },
] satisfies readonly ApiLinkedResource[]

const denseDatasetOneLinks = [
  {
    name: "Nickel iron oxide catalyst",
    direction: "undirected",
    relationship_type: null,
    resource_type: "sample",
    unique_id: "fixture-sample-1",
  },
] satisfies readonly ApiLinkedResource[]

const denseProjects = Array.from({ length: 24 }, (_, index) => ({
  ...demoWorkspace.projects[index % demoWorkspace.projects.length],
  unique_id: `fixture-project-${index + 1}`,
  project_id: `project-${String(index + 1).padStart(2, "0")}`,
  title:
    index === 0
      ? "A deliberately long project title for validating dense desktop layouts"
      : `Catalysis research project ${index + 1}`,
}))

const denseSharedResources = {
  datasets: ["fixture-dataset-2", "fixture-dataset-3"],
  samples: ["fixture-sample-2", "fixture-sample-3"],
} as const

function denseWorkspace(): Workspace {
  return {
    ...demoWorkspace,
    id: "dense-workspace",
    projects: denseProjects,
    instruments: Array.from({ length: 23 }, (_, index) => ({
      ...demoWorkspace.instruments[0],
      unique_id: `fixture-instrument-${index + 1}`,
      instrument_id: `dense-instrument-${index + 1}`,
      instrument_name:
        index === 0
          ? "High-resolution operando hard X-ray microprobe instrument"
          : `Research instrument ${index + 1}`,
    })),
    samples: Array.from({ length: 54 }, (_, index) => {
      const project =
        index === 2 || index === 4
          ? null
          : denseProjects[index === 3 ? 0 : index % 24]
      return {
        ...demoWorkspace.samples[index % demoWorkspace.samples.length],
        unique_id: `fixture-sample-${index + 1}`,
        sample_name:
          index === 0
            ? "Nickel iron oxide catalyst with a deliberately long preparation identifier"
            : `Catalyst sample ${index + 1}`,
        project,
        project_id: project?.project_id ?? null,
        project_relation: null,
        public: index % 2 === 0,
        links:
          index === 0
            ? denseSampleOneLinks
            : index === 1
              ? denseSampleTwoLinks
              : index === 2
                ? null
                : index === 3
                  ? []
                  : demoWorkspace.samples[index % demoWorkspace.samples.length]
                      .links,
      }
    }),
    datasets: Array.from({ length: 57 }, (_, index) => {
      const project =
        index === 2 || index === 4
          ? null
          : denseProjects[index === 3 ? 0 : index % 24]
      return {
        ...demoWorkspace.datasets[index % demoWorkspace.datasets.length],
        unique_id: `fixture-dataset-${index + 1}`,
        project,
        project_id: project?.project_id ?? null,
        project_relation: null,
        public: index % 2 === 0,
        instrument_id:
          index < 54
            ? densePrimaryInstrument.instrument_id
            : index === 56
              ? null
              : denseSecondaryInstrument.instrument_id,
        instrument:
          index < 54
            ? densePrimaryInstrument
            : index === 55
              ? null
              : index === 56
                ? null
                : denseSecondaryInstrument,
        dataset_name:
          index === 0
            ? "Operando spectroscopy acquisition with a deliberately long descriptive name"
            : `Measurement dataset ${index + 1}`,
        links:
          index === 0
            ? denseDatasetOneLinks
            : demoWorkspace.datasets[index % demoWorkspace.datasets.length]
                .links,
      }
    }),
  }
}

export function isFixtureResourceSharedWithProject(
  scenario: FixtureScenario | undefined,
  projectMfid: string,
  family: "datasets" | "samples",
  resourceMfid: string
) {
  return (
    scenario === "dense" &&
    projectMfid === "fixture-project-1" &&
    (denseSharedResources[family] as readonly string[]).includes(resourceMfid)
  )
}

function workspaceForScenario(scenario: FixtureScenario): Workspace {
  if (scenario === "empty") {
    return {
      ...demoWorkspace,
      id: "empty-workspace",
      projects: [],
      instruments: [],
      samples: [],
      datasets: [],
      files: [],
    }
  }
  if (scenario === "restricted") {
    return {
      ...demoWorkspace,
      id: "restricted-workspace",
      projects: [demoWorkspace.projects[1]],
      instruments: [],
      samples: [],
      datasets: [],
      files: [],
    }
  }
  if (scenario === "dense") return denseWorkspace()
  return {
    ...demoWorkspace,
    samples: [...demoWorkspace.samples, ...publicOnlySamples],
    datasets: [...demoWorkspace.datasets, ...publicOnlyDatasets].sort(
      (left, right) => right.unique_id.localeCompare(left.unique_id)
    ),
  }
}

export function readWorkspaceFixture(
  scenario: FixtureScenario = defaultFixtureScenario,
  privilegeMode: WorkspacePrivilegeMode = "normal"
): WorkspaceSource {
  const fixturesEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.HUB_ENABLE_FIXTURES === "true"

  if (!fixturesEnabled) {
    return {
      status: "unavailable",
      reason: "The Crucible API login exchange is not connected yet.",
    }
  }

  if (process.env.NODE_ENV === "production" && scenario !== "populated") {
    return {
      status: "unavailable",
      reason: "Fixture scenarios are available only during development.",
    }
  }

  const workspace = workspaceForScenario(scenario)
  return {
    status: "ready",
    mode: "fixture",
    accountPreferencesEnabled: readAccountPreferencesEnabled("fixture"),
    privilegeMode,
    uploadIngestionEnabled: readUploadIngestionEnabled("fixture"),
    uploadsEnabled: readUploadsEnabled("fixture"),
    workspace: {
      ...workspace,
      account: {
        ...workspace.account,
        authorization: {
          ...workspace.account.authorization,
          effective_privilege_mode: privilegeMode,
        },
        capabilities: {
          ...workspace.account.capabilities,
          can_create_for_others: privilegeMode === "elevated",
          can_manage_service_accounts: privilegeMode === "elevated",
        },
      },
    },
  }
}

export function assertFixtureScenarioAvailable(
  scenario: FixtureScenario | undefined,
  endpoint: "datasets" | "instruments"
) {
  if (scenario === "partial" && endpoint === "datasets") {
    throw new Error("Datasets are temporarily unavailable.")
  }
  if (scenario === "degraded" && endpoint === "instruments") {
    throw new Error("Instruments are temporarily unavailable.")
  }
}
