import type { components } from "@/generated/crucible-api"
import type { FixtureScenario } from "./fixture-scenarios"
import type { WorkspacePrivilegeMode } from "./privilege-mode"

type Schema<TSchemaName extends keyof components["schemas"]> =
  components["schemas"][TSchemaName]

export type WorkspacePerson = Pick<
  Schema<"UserPublicRead">,
  "first_name" | "is_service_account" | "last_name" | "unique_id" | "username"
>

export type WorkspaceAccount = Omit<
  Pick<
    Schema<"AccountProfileRead">,
    | "authorization"
    | "capabilities"
    | "email"
    | "first_name"
    | "is_service_account"
    | "last_active_at"
    | "last_name"
    | "unique_id"
    | "username"
  >,
  "is_service_account"
> & {
  is_service_account: boolean
}

export type WorkspaceAccountProfileUpdate = {
  email?: string | null
  first_name?: string
  last_name?: string
  username?: string | null
}

export type WorkspaceApiCredentialStatus = Pick<
  Schema<"ApiKeyVerify">,
  "created_at" | "expires_at" | "last_used_at" | "valid"
>

export type WorkspaceResourceCapabilities = Schema<"ResourceCapabilities">

export type WorkspaceProject = Pick<
  Schema<"ProjectWithLead">,
  | "creation_time"
  | "last_activity_at"
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
  members?: Schema<"AccessGroupMemberRead">[] | null
  role?: string | null
  scientific_metadata: WorkspaceScientificMetadata | null
  status: string | null
}

export type WorkspaceProjectSort = Schema<"ProjectSort">
export type WorkspaceSortDirection = Schema<"SortDirection">

export type WorkspaceUserProject = Omit<
  Schema<"ProjectWithLead">,
  "deletion_request" | "scientific_metadata"
> & {
  role?: string | null
  scientific_metadata: WorkspaceScientificMetadata | null
}

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
  | "data_format"
  | "dataset_name"
  | "instrument_id"
  | "measurement"
  | "modification_time"
  | "project_id"
  | "public"
  | "session_name"
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

export type WorkspaceAccessPermission = Schema<"AccessPermission">

export type WorkspaceInstrument = Pick<
  Schema<"InstrumentResponse">,
  | "creation_time"
  | "description"
  | "last_activity_at"
  | "instrument_id"
  | "instrument_name"
  | "instrument_type"
  | "location"
  | "manufacturer"
  | "model"
  | "modification_time"
  | "other_id"
  | "other_id_source"
  | "role"
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

export type WorkspaceInstrumentSort = Schema<"InstrumentSort">

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
  projectMfid: string | null
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
  projectMfid: string | null
  public: boolean
  session_name: string | null
  timestamp: string | null
}

export type WorkspaceOwnershipTransfer = Omit<
  Schema<"TransferOwnershipRead">,
  "resource_id"
>

export type WorkspaceDeletionPreview = Omit<
  Schema<"DeletionPreviewRead">,
  | "blocking"
  | "join_requests_removed"
  | "memberships_removed"
  | "removed_grants"
  | "resource_id"
  | "service_accounts_unbound"
> & {
  blocking: Record<string, number>
  join_requests_removed: number
  memberships_removed: number
  removed_grants: Schema<"DeletionGrantRead">[]
  service_accounts_unbound: number
}

export type WorkspaceProjectReassignment = Schema<"ReassignProjectRead">

export type WorkspaceDatasetInstrumentAssignment =
  Schema<"DatasetInstrumentRead">

export type WorkspaceLinkedResource = {
  name: string | null
  relationship: "associated" | "child" | "parent"
  relationship_type?: string | null
  resource_type: string
  unique_id: string
}

export type WorkspaceResourceGraphNode = {
  context: string | null
  dataFormat: string | null
  expansionAvailability: {
    ancestors: boolean
    associations: boolean
    descendants: boolean
  }
  hasMoreRelationships: boolean | null
  instrument: Schema<"InstrumentReferenceRead"> | null
  kind: "dataset" | "sample"
  name: string
  project: Schema<"ProjectReferenceRead"> | null
  traversalDepth: number
  unique_id: string
}

export type WorkspaceResourceGraphEdge = {
  directed: boolean
  id: string
  relationship: "associated" | "parent"
  relationshipType: Schema<"LinkRelationshipType"> | null
  source: string
  target: string
}

export type WorkspaceResourceGraph = {
  edgeLimit: number
  edges: readonly WorkspaceResourceGraphEdge[]
  hasMore: boolean
  nodeLimit: number
  nodes: readonly WorkspaceResourceGraphNode[]
  requestedDepth: number
  returnedDepth: number
  rootMfid: string
  truncated: boolean
  truncationReasons: readonly Schema<"GraphTruncationReason">[]
}

export type WorkspaceResourceGraphDirection = Schema<"GraphDirection">

export type WorkspaceResourceGraphRelationshipKind =
  Schema<"GraphRelationshipKind">

export type WorkspaceResourceGraphRelationshipType =
  Schema<"GraphRelationshipTypeFilter">

export type WorkspaceResourceGraphRequest = {
  depth?: number
  direction?: WorkspaceResourceGraphDirection
  relationshipKinds?: readonly WorkspaceResourceGraphRelationshipKind[]
  relationshipTypes?: readonly WorkspaceResourceGraphRelationshipType[]
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
  | "capabilities"
  | "id"
  | "project_id"
  | "project_mfid"
  | "reason"
  | "request_time"
  | "requester"
  | "requester_id"
  | "resource_mfid"
  | "resource_name"
  | "resource_type"
  | "review_time"
  | "reviewer"
  | "reviewer_id"
  | "reviewer_notes"
  | "status"
>

export type WorkspaceDeletionRequestSort = Schema<"DeletionRequestSort">

export type WorkspaceDeletionRequestPage = {
  items: readonly WorkspaceDeletionRequest[]
  limit: number
  nextCursor: string | null
  total: number | null
}

export type WorkspaceDeletionAudit = Schema<"DeletionAuditLogRead">

export type WorkspaceDeletionAuditPage = {
  items: readonly WorkspaceDeletionAudit[]
  limit: number
  nextCursor: string | null
  total: number | null
}

type WorkspaceResourceBase = {
  capabilities: WorkspaceResourceCapabilities | null
  creation_time: string | null
  kind: "dataset" | "instrument" | "project" | "sample"
  modification_time: string | null
  name: string
  owner: WorkspacePerson | null
  role?: string | null
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

export type WorkspaceDatasetFile = Omit<
  Schema<"AssociatedFileRead">,
  "etag"
> & {
  readonly etag?: string
}

export type WorkspaceIngestionRequest = {
  datasetMfid: string | null
  fileMfid: string | null
  fileToUpload: string | null
  id: number | null
  ingestionClass: string | null
  ingestionGitHash: string | null
  status: string | null
  timeCompleted: string | null
  timeCreated: string | null
}

export type WorkspaceIngestionRequestPage = {
  items: readonly WorkspaceIngestionRequest[]
  total: number
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

export type WorkspaceFileDisposition = "attachment" | "inline"

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

export type WorkspaceCursorPage<TItem> = {
  items: readonly TItem[]
  limit: number
  nextCursor: string | null
  total: number | null
}

export type WorkspaceProjectPage = WorkspaceCursorPage<WorkspaceProject>

export type WorkspaceInstrumentPage = WorkspaceCursorPage<WorkspaceInstrument>

export type WorkspaceSearchKind =
  "dataset" | "instrument" | "person" | "project" | "sample"

export type WorkspaceSearchResult = {
  context: string | null
  is_service_account?: boolean | null
  kind: WorkspaceSearchKind
  name: string
  projectId?: string | null
  unique_id: string
}

export type WorkspaceServiceAccount = Schema<"ServiceAccountAdminRead"> & {
  api_key_status?: WorkspaceApiCredentialStatus | null
  last_active_at?: string | null
}

export type WorkspaceServiceAccountDetail =
  Schema<"ServiceAccountAdminDetail"> & {
    last_active_at?: string | null
  }

export type WorkspaceServiceAccountSort =
  "username" | "unique_id" | "last_active"

export type WorkspaceServiceAccountCredential = Schema<"ServiceAccountRead">

export type WorkspaceServiceAccountProfileUpdate = {
  first_name?: string
  last_name?: string
  username?: string
}

export type WorkspaceServiceAccountPlatformRole =
  Schema<"ServiceAccountPlatformRoleUpdate">["platform_role"]

export type WorkspaceServiceAccountPage =
  WorkspaceCursorPage<WorkspaceServiceAccount>

export type WorkspaceAdminUser = Schema<"UserRead"> & {
  platform_role?: components["schemas"]["PlatformRole"] | null
}

export type WorkspaceUserSort = Schema<"UserSort">

export type WorkspaceUserPlatformRole =
  Schema<"UserPlatformRoleUpdate">["platform_role"]

export type WorkspaceAdminUserPage = WorkspaceCursorPage<WorkspaceAdminUser>

export type WorkspaceUserCreate = {
  email?: string | null
  first_name: string
  last_name: string
  project_ids?: readonly string[] | null
  unique_id?: string | null
  username: string
}

export type WorkspaceUserUpdate = {
  email?: string | null
  first_name?: string
  last_name?: string
  username?: string | null
}

export type WorkspaceAccessGroup = Schema<"AccessGroupRead">

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

export type WorkspaceUploadSessionState =
  "uploading" | "completed" | "failed" | "aborted"

export type WorkspaceUploadSession = {
  acknowledgedPartNumbers: number[]
  datasetMfid: string
  failureCode?: string
  file?: WorkspaceDatasetFile
  partSize?: number
  state: WorkspaceUploadSessionState
  uploadId: string
}

export type WorkspaceUploadInitiation =
  | { partSize: number; state: WorkspaceUploadSessionState; uploadId: string }
  | { file: WorkspaceDatasetFile; state: "completed" }
  | { etag: string; fileMfid: string; state: "filename_exists" }
  | { state: "file_changed" }

export type WorkspaceUploadSignedPart = {
  headers: Record<string, string>
  partNumber: number
  url: string
}

export type WorkspaceSource =
  | {
      status: "ready"
      mode: WorkspaceMode
      accountPreferencesEnabled: boolean
      privilegeMode: WorkspacePrivilegeMode
      uploadIngestionEnabled: boolean
      uploadsEnabled: boolean
      workspace: Workspace
      sessionAuth?: boolean
    }
  | {
      status: "unavailable"
      reason: string
      authRequired?: boolean
    }
