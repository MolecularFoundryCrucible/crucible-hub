import type { components } from "@/generated/crucible-api"
import type { FixtureScenario } from "./fixture-scenarios"

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

export type WorkspacePerson = Pick<
  Schema<"UserPublicRead">,
  "first_name" | "last_name" | "unique_id" | "username"
>

export type WorkspaceAccount = Pick<
  Schema<"UserRead">,
  | "email"
  | "first_name"
  | "is_service_account"
  | "last_name"
  | "unique_id"
  | "username"
>

export type WorkspaceAccountProfileUpdate = {
  email?: string | null
  first_name?: string
  last_name?: string
  username?: string | null
}

export type WorkspaceResourceCapabilities = Schema<"ResourceCapabilities">

export type WorkspaceProject =
  | (Pick<
      Schema<"ProjectMinimalRead">,
      "project_id" | "title" | "unique_id"
    > & {
      capabilities: WorkspaceResourceCapabilities | null
    })
  | (Pick<
      Schema<"ProjectWithLead">,
      | "creation_time"
      | "lead"
      | "modification_time"
      | "organization"
      | "project_id"
      | "project_lead_orcid"
      | "scientific_metadata"
      | "title"
      | "unique_id"
    > & {
      capabilities: WorkspaceResourceCapabilities | null
      lead: WorkspacePerson | null
      members?: readonly Schema<"AccessGroupMemberRead">[] | null
      scientific_metadata: WorkspaceScientificMetadata | null
      status: string | null
    })

export type WorkspaceProjectReference = Pick<
  Schema<"ProjectReferenceRead">,
  "project_id" | "title" | "unique_id"
>

export type WorkspaceProjectCreate = {
  organization: string
  project_id: string
  project_lead: string
  title: string
}

export type WorkspaceProjectRelation = "assigned" | "shared"

export type WorkspaceSample = Pick<
  Schema<"SampleResponse">,
  | "creation_time"
  | "modification_time"
  | "project_id"
  | "public"
  | "sample_name"
  | "sample_type"
  | "timestamp"
  | "unique_id"
> & {
  owner: WorkspacePerson | null
  project?: WorkspaceProjectReference | null
  project_relation?: WorkspaceProjectRelation | null
}

export type WorkspaceDataset = Pick<
  Schema<"DatasetResponse">,
  | "creation_time"
  | "dataset_name"
  | "instrument_id"
  | "measurement"
  | "modification_time"
  | "project_id"
  | "public"
  | "size"
  | "timestamp"
  | "unique_id"
> & {
  instrument?: Pick<
    Schema<"InstrumentReferenceRead">,
    "instrument_id" | "instrument_name" | "unique_id"
  > | null
  owner: WorkspacePerson | null
  project: WorkspaceProjectReference | null
  project_relation?: WorkspaceProjectRelation | null
}

export type WorkspaceInstrument = Pick<
  Schema<"InstrumentResponse">,
  | "description"
  | "instrument_id"
  | "instrument_name"
  | "instrument_type"
  | "location"
  | "manufacturer"
  | "model"
  | "modification_time"
  | "other_id"
  | "other_id_source"
  | "status"
  | "unique_id"
> & {
  capabilities: WorkspaceResourceCapabilities | null
  owner: WorkspacePerson | null
}

export type WorkspaceInstrumentDescriptiveUpdate = {
  description: string | null
  instrument_id: string | null
  instrument_name: string
  instrument_type: string | null
  location: string
  manufacturer: string | null
  model: string | null
  modification_time: string | null
  other_id: string | null
  other_id_source: string | null
  unique_id: string
}

export type WorkspaceInstrumentLifecycleUpdate = {
  modification_time: string | null
  status: WorkspaceInstrumentStatus
  unique_id: string
}

export type WorkspaceInstrumentStatus = Schema<"InstrumentStatus">

export type WorkspaceInstrumentOperator = Schema<"AccessGroupMemberRead">

export type WorkspaceInstrumentCreate = Pick<
  Schema<"InstrumentCreate">,
  | "description"
  | "instrument_id"
  | "instrument_name"
  | "instrument_type"
  | "location"
  | "manufacturer"
  | "model"
  | "other_id"
  | "other_id_source"
>

export type WorkspaceSampleCreate = {
  description: string | null
  projectMfid: string
  public: boolean
  sample_name: string
  sample_type: string | null
  timestamp: string | null
}

export type WorkspaceDatasetCreate = {
  data_format: string | null
  data_type: string | null
  dataset_name: string
  instrumentMfid: string | null
  measurement: string | null
  projectMfid: string
  public: boolean
  session_name: string | null
  timestamp: string | null
}

export type WorkspaceOwnershipTransfer = Schema<"TransferOwnershipRead">

export type WorkspaceProjectReassignment = Schema<"ReassignProjectRead">

export type WorkspaceLinkedResource = {
  name: string | null
  relationship: "associated" | "child" | "parent"
  relationship_type?: string | null
  resource_type: string
  unique_id: string
}

export type WorkspaceResourceGraphNode = {
  kind: "dataset" | "sample"
  name: string
  unique_id: string
}

export type WorkspaceResourceGraphEdge = {
  relationship: "associated" | "parent"
  source: string
  target: string
}

export type WorkspaceResourceGraph = {
  edges: readonly WorkspaceResourceGraphEdge[]
  nodes: readonly WorkspaceResourceGraphNode[]
  rootMfid: string
}

export type WorkspaceResourceAccessGrant = Schema<"AccessGrantRead">

export type WorkspaceResourceAccessPermission = Exclude<
  Schema<"AccessPermission">,
  "owner"
>

export type WorkspaceResourceAccessPrincipalKind = "users" | "projects"

export type WorkspaceResourcePublicAccessMutation = {
  grants: readonly WorkspaceResourceAccessGrant[]
  resource: WorkspaceResourceDetail
}

type WorkspaceRelationshipOperationBase = {
  action: "link" | "unlink"
  scenario?: FixtureScenario
  sourceMfid: string
  targetMfid: string
}

export type WorkspaceRelationshipType = "is_derived_from" | "is_part_of"

export type WorkspaceRelationshipOperation =
  | (WorkspaceRelationshipOperationBase & {
      relationship: "parent" | "child"
      relationshipType?: WorkspaceRelationshipType | null
      sourceKind: "sample"
      targetKind: "sample"
    })
  | (WorkspaceRelationshipOperationBase & {
      relationship: "parent" | "child"
      relationshipType?: WorkspaceRelationshipType | null
      sourceKind: "dataset"
      targetKind: "dataset"
    })
  | (WorkspaceRelationshipOperationBase & {
      relationship: "associated"
      sourceKind: "dataset"
      targetKind: "sample"
    })
  | (WorkspaceRelationshipOperationBase & {
      relationship: "associated"
      sourceKind: "sample"
      targetKind: "dataset"
    })

export type WorkspaceRelationshipMutationResult = {
  source: WorkspaceResourceDetail
  target: WorkspaceResourceDetail
}

export type WorkspaceDeletionRequest = Pick<
  Schema<"DeletionRequestRead">,
  | "id"
  | "project_id"
  | "reason"
  | "request_time"
  | "requester_id"
  | "resource_id"
  | "resource_name"
  | "resource_type"
  | "review_time"
  | "reviewer_id"
  | "reviewer_notes"
  | "status"
>

type WorkspaceResourceBase = {
  capabilities: WorkspaceResourceCapabilities | null
  creation_time: string | null
  kind: "dataset" | "instrument" | "project" | "sample"
  modification_time: string | null
  name: string
  owner: WorkspacePerson | null
  scientific_metadata: WorkspaceScientificMetadata | null
  unique_id: string
}

export type WorkspaceMetadataValue =
  | boolean
  | null
  | number
  | string
  | readonly WorkspaceMetadataValue[]
  | { readonly [key: string]: WorkspaceMetadataValue }

export type WorkspaceScientificMetadata = Readonly<
  Record<string, WorkspaceMetadataValue>
>

export type WorkspaceScientificMetadataWrite =
  | {
      kind: "merge"
      metadata: WorkspaceScientificMetadata
    }
  | {
      kind: "replace"
      metadata: WorkspaceScientificMetadata
    }

export type WorkspaceScientificMetadataUpdate = {
  scientific_metadata: WorkspaceScientificMetadata
  unique_id: string
}

export type WorkspaceResourceDetail =
  | (WorkspaceResourceBase & {
      data_format: string | null
      data_type: string | null
      deletion_request?: WorkspaceDeletionRequest | null
      instrument: Schema<"InstrumentReferenceRead"> | null
      instrument_id: string | null
      kind: "dataset"
      links: readonly WorkspaceLinkedResource[] | null
      measurement: string | null
      project: Schema<"ProjectReferenceRead"> | null
      project_id: string | null
      public: boolean
      session_name: string | null
      size: number | null
      timestamp: string | null
    })
  | (WorkspaceResourceBase & {
      deletion_request?: WorkspaceDeletionRequest | null
      description: string | null
      kind: "sample"
      links: readonly WorkspaceLinkedResource[] | null
      project: Schema<"ProjectReferenceRead"> | null
      project_id: string | null
      public: boolean
      sample_type: string | null
      timestamp: string | null
    })
  | (WorkspaceResourceBase & {
      description: string | null
      instrument_id: string | null
      instrument_type: string | null
      kind: "instrument"
      location: string
      manufacturer: string | null
      model: string | null
      other_id: string | null
      other_id_source: string | null
      status: string | null
    })
  | (WorkspaceResourceBase & {
      kind: "project"
      organization: string
      project_id: string
      status: string | null
    })

export type WorkspaceDatasetFile = Schema<"AssociatedFileRead">

export type WorkspaceIngestionRequest = {
  datasetMfid: string | null
  fileMfid: string | null
  id: number | null
  ingestionClass: string | null
  status: string | null
  timeCompleted: string | null
  timeCreated: string | null
}

export type WorkspaceDatasetThumbnail = Pick<
  Schema<"ThumbnailRead">,
  "id" | "mime_type" | "thumbnail_b64str" | "thumbnail_name"
>

export type WorkspaceDatasetThumbnailOperation =
  | {
      action: "add"
      datasetMfid: string
      scenario?: FixtureScenario
      thumbnail_b64str: string
      thumbnail_name: string
    }
  | {
      action: "rename"
      datasetMfid: string
      scenario?: FixtureScenario
      thumbnailId: number
      thumbnail_name: string
    }
  | {
      action: "delete"
      datasetMfid: string
      scenario?: FixtureScenario
      thumbnailId: number
    }

export type WorkspaceFileDownload =
  | { status: "ready"; url: string; expiresInSeconds: number }
  | { status: "unavailable" }

export type WorkspaceSampleDescriptiveUpdate = {
  description: string | null
  modification_time: string | null
  sample_name: string
  sample_type: string | null
  timestamp: string | null
  unique_id: string
}

export type WorkspaceDatasetDescriptiveUpdate = {
  data_format: string | null
  data_type: string | null
  dataset_name: string
  measurement: string | null
  modification_time: string | null
  session_name: string | null
  timestamp: string | null
  unique_id: string
}

export type Workspace = {
  id: string
  referenceTime: string
  account: WorkspaceAccount
  people: readonly WorkspacePerson[]
  projects: readonly WorkspaceProject[]
  instruments: readonly WorkspaceInstrument[]
  samples: readonly WorkspaceSample[]
  datasets: readonly WorkspaceDataset[]
  files: readonly Schema<"AssociatedFileRead">[]
}

export type WorkspaceContent = Omit<
  Workspace,
  "account" | "files" | "instruments" | "projects"
>

export function workspaceContent(workspace: Workspace): WorkspaceContent {
  const {
    account: _account,
    files: _files,
    instruments: _instruments,
    projects: _projects,
    ...content
  } = workspace
  return content
}

export type WorkspaceProjectPage = {
  items: readonly WorkspaceProject[]
  limit: number
  offset: number
  total: number | null
}

export type WorkspaceInstrumentPage = {
  items: readonly WorkspaceInstrument[]
  limit: number
  offset: number
  total: number | null
}

export type WorkspaceCursorPage<TItem> = {
  items: readonly TItem[]
  limit: number
  nextCursor: string | null
  total: number | null
}

export type WorkspaceSearchKind =
  "dataset" | "instrument" | "person" | "project" | "sample"

export type WorkspaceSearchResult = {
  context: string | null
  kind: WorkspaceSearchKind
  name: string
  unique_id: string
}

export type WorkspaceSearchGroup = {
  error: boolean
  items: readonly WorkspaceSearchResult[]
  kind: WorkspaceSearchKind
  total: number | null
}

export type WorkspaceSearchResponse = {
  groups: readonly WorkspaceSearchGroup[]
  query: string
}

export type WorkspaceMode = "api" | "fixture"

export type WorkspaceSource =
  | {
      status: "ready"
      mode: WorkspaceMode
      workspace: Workspace
    }
  | {
      status: "unavailable"
      reason: string
    }
