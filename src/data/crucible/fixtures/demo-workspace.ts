import type { components } from "@/generated/crucible-api"

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

type DemoWorkspaceContract = {
  id: "operando-catalyst-study"
  referenceTime: string
  account: Schema<"UserRead">
  people: readonly Schema<"UserPublicRead">[]
  projects: readonly (
    | Schema<"ProjectWithLead">
    | (Schema<"ProjectMinimalRead"> & {
        capabilities?: Schema<"ResourceCapabilities"> | null
      })
  )[]
  instruments: readonly Schema<"InstrumentResponse">[]
  samples: readonly Schema<"SampleResponse">[]
  datasets: readonly Schema<"DatasetResponse">[]
  files: readonly Schema<"AssociatedFileRead">[]
}

const account = {
  unique_id: "0000-0000-0000-000X",
  username: "avery.chen",
  first_name: "Avery",
  last_name: "Chen",
  email: "avery.chen@example.invalid",
  is_service_account: false,
} satisfies Schema<"UserRead">

const collaborator = {
  unique_id: "0000-0000-0000-0018",
  username: "morgan.lee",
  first_name: "Morgan",
  is_service_account: false,
  last_name: "Lee",
} satisfies Schema<"UserPublicRead">

const prospectiveMember = {
  unique_id: "0000-0000-0000-0026",
  username: "jamie.patel",
  first_name: "Jamie",
  is_service_account: false,
  last_name: "Patel",
} satisfies Schema<"UserPublicRead">

const projectReference = {
  unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z3",
  project_id: "operando-catalyst-mapping",
  title: "Operando Catalyst Mapping",
} satisfies Schema<"ProjectReferenceRead">

const instrumentReference = {
  unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z4",
  instrument_id: "hard-xray-microprobe",
  instrument_name: "Hard X-ray Microprobe",
} satisfies Schema<"InstrumentReferenceRead">

const capabilities = {
  can_change_status: true,
  can_edit: true,
  can_manage_access: true,
  can_transfer: true,
  max_grant_role: "admin",
} satisfies Schema<"ResourceCapabilities">

const spectroscopyDatasetSummary = {
  unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
  public: false,
  dataset_name: "NiFe K-edge operando series",
  owner_orcid: account.unique_id,
  project_id: projectReference.project_id,
  project: projectReference,
  instrument_id: instrumentReference.instrument_id,
  instrument_name: instrumentReference.instrument_name,
  instrument: instrumentReference,
  timestamp: "2026-08-28T17:42:00Z",
  size: 284_917_312,
  data_format: "HDF5",
  measurement: "X-ray absorption spectroscopy",
  data_type: "spectrum series",
  session_name: "operando-cycle-04",
} satisfies Schema<"DatasetRead">

const diffractionDatasetSummary = {
  unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z8",
  public: false,
  dataset_name: "NiFe phase evolution",
  owner_orcid: collaborator.unique_id,
  project_id: projectReference.project_id,
  project: projectReference,
  timestamp: "2026-08-29T19:10:00Z",
  size: 91_304_240,
  data_format: "NeXus",
  measurement: "X-ray diffraction",
  data_type: "diffraction series",
  session_name: "operando-cycle-04",
} satisfies Schema<"DatasetRead">

export const demoWorkspace = {
  id: "operando-catalyst-study",
  referenceTime: "2026-09-01T16:00:00Z",
  account,
  people: [account, collaborator, prospectiveMember],
  projects: [
    {
      ...projectReference,
      organization: "Example National Laboratory",
      project_lead_orcid: account.unique_id,
      status: "active",
      capabilities,
      lead: account,
      scientific_metadata: {
        research_area: "electrocatalysis",
        beamtime_cycle: "2026-2",
      },
      creation_time: "2026-06-12T18:30:00Z",
      modification_time: "2026-08-30T21:14:00Z",
      members: [
        {
          unique_id: account.unique_id,
          username: account.username,
          first_name: account.first_name,
          last_name: account.last_name,
          is_service_account: false,
          role: "owner",
        },
        {
          ...collaborator,
          is_service_account: false,
          role: "editor",
        },
        {
          unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2ZA",
          username: "beamline-collector",
          first_name: "Beamline",
          last_name: "Collector",
          is_service_account: true,
          role: "contributor",
        },
      ],
    },
    {
      unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2ZB",
      project_id: "porous-framework-screening",
      title: "Porous Framework Screening",
      capabilities: null,
    },
  ],
  instruments: [
    {
      ...instrumentReference,
      owner_orcid: account.unique_id,
      owner: account,
      location: "Beamline 5.3.2",
      manufacturer: "Example Instruments",
      model: "XRM-5000",
      description: "Scanning hard X-ray microprobe for operando mapping.",
      instrument_type: "X-ray microscope",
      resource_type: "instrument",
      creation_time: "2025-11-04T20:00:00Z",
      modification_time: "2026-08-20T14:25:00Z",
      scientific_metadata: {
        energy_range_kev: [5, 18],
        spatial_resolution_nm: 120,
      },
      status: "active",
      capabilities,
    },
  ],
  samples: [
    {
      unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
      sample_name: "NiFe oxide catalyst A",
      sample_type: "electrocatalyst",
      owner_orcid: account.unique_id,
      project_id: projectReference.project_id,
      project: projectReference,
      description:
        "Nickel-iron oxide catalyst on carbon paper after activation.",
      timestamp: "2026-08-27T16:20:00Z",
      public: false,
      resource_type: "sample",
      creation_time: "2026-08-27T16:24:00Z",
      modification_time: "2026-08-30T20:15:00Z",
      scientific_metadata: {
        substrate: "carbon paper",
        electrolyte: "1 M KOH",
        nominal_iron_fraction: 0.2,
      },
      datasets: [spectroscopyDatasetSummary, diffractionDatasetSummary],
      deletion_request: null,
      links: [
        {
          name: "NiFe K-edge operando series",
          direction: "undirected",
          relationship_type: null,
          resource_type: "dataset",
          unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z7",
        },
      ],
      owner: account,
      capabilities,
    },
    {
      unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z6",
      sample_name: "NiFe oxide catalyst B",
      sample_type: "electrocatalyst",
      owner_orcid: collaborator.unique_id,
      project_id: projectReference.project_id,
      description: null,
      timestamp: "2026-08-29T15:05:00Z",
      public: true,
      resource_type: "sample",
      creation_time: "2026-08-29T15:06:00Z",
      modification_time: null,
      scientific_metadata: null,
      datasets: [],
      deletion_request: null,
      links: [],
      owner: collaborator,
      capabilities: {
        can_change_status: false,
        can_edit: false,
        can_manage_access: false,
        can_transfer: false,
        max_grant_role: null,
      },
    },
  ],
  datasets: [
    {
      ...spectroscopyDatasetSummary,
      resource_type: "dataset",
      creation_time: "2026-08-28T18:03:00Z",
      modification_time: "2026-08-30T22:40:00Z",
      scientific_metadata: {
        acquisition: {
          edge: "Fe K",
          energy_ev: {
            points: 401,
            start: 7100,
            stop: 7300,
          },
          potential_v_rhe: [1.1, 1.25, 1.4, 1.55],
        },
        environment: {
          electrolyte: "1 M KOH",
          temperature: {
            unit: "K",
            value: 298,
          },
        },
        processing: {
          excluded_scans: [],
          normalization: "edge step",
        },
      },
      deletion_request: null,
      links: [
        {
          name: "NiFe oxide catalyst A",
          direction: "undirected",
          relationship_type: null,
          resource_type: "sample",
          unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z5",
        },
      ],
      owner: account,
      capabilities,
    },
    {
      ...diffractionDatasetSummary,
      resource_type: "dataset",
      creation_time: "2026-08-29T19:26:00Z",
      modification_time: null,
      scientific_metadata: {
        wavelength_angstrom: 0.7293,
        exposure_seconds: 5,
      },
      deletion_request: null,
      links: [],
      owner: collaborator,
      capabilities: {
        ...capabilities,
        can_transfer: false,
      },
    },
    {
      unique_id: "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
      public: true,
      dataset_name: "Activated catalyst morphology",
      owner_orcid: account.unique_id,
      project_id: projectReference.project_id,
      project: projectReference,
      instrument_id: instrumentReference.instrument_id,
      instrument_name: instrumentReference.instrument_name,
      instrument: instrumentReference,
      timestamp: "2026-08-30T16:12:00Z",
      size: 1_842_337_920,
      data_format: "OME-TIFF",
      measurement: "X-ray fluorescence microscopy",
      data_type: "image stack",
      session_name: "post-cycle-mapping",
      resource_type: "dataset",
      creation_time: "2026-08-30T17:31:00Z",
      modification_time: "2026-08-31T19:11:00Z",
      scientific_metadata: {
        pixel_size_nm: 150,
        channels: ["Fe", "Ni", "O"],
      },
      deletion_request: null,
      links: [],
      owner: account,
      capabilities,
    },
  ],
  files: [
    {
      mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2ZC",
      dataset_id: 101,
      dataset_mfid: spectroscopyDatasetSummary.unique_id,
      filename: "operando-cycle-04.h5",
      storage_backend: "gcs",
      size: 281_206_784,
      sha256_hash:
        "4cc32a63d3a12d0f99b345ad5e747e9ab831e7a24d7426d4eba785c98d4951a1",
      access_note: null,
      storage_path: null,
    },
    {
      mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2ZD",
      dataset_id: 101,
      dataset_mfid: spectroscopyDatasetSummary.unique_id,
      filename: "run-notes.txt",
      storage_backend: "local",
      size: 18_421,
      sha256_hash:
        "713a7c531b7c19f8b11ed6eb16960751485822525609cd28d8da3e621f26b29d",
      access_note: "Available to project members.",
      storage_path: null,
    },
    {
      mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2ZE",
      dataset_id: 103,
      dataset_mfid: "01J6Y8N4Q2R7M9K3T5V0W1X2Z9",
      filename: "activated-catalyst-map.ome.tiff",
      storage_backend: "gcs",
      size: 1_842_337_920,
      sha256_hash:
        "529ae8aaaf9f19acf36270be58e1991bf0a0f6529893708dd9c3cea529bb9332",
      access_note: null,
      storage_path: null,
    },
  ],
} satisfies DemoWorkspaceContract
