import { z } from "zod"

const facetSearchValue = z.string().max(255).optional().catch(undefined)
const selectedFacet = z
  .union([z.literal(true), z.literal("true")])
  .transform(() => true as const)
  .optional()
  .catch(undefined)

export const facetFilterSearchFields = {
  dataFormat: facetSearchValue,
  dataFormatIsNull: selectedFacet,
  dataFormatSet: selectedFacet,
  measurement: facetSearchValue,
  measurementIsNull: selectedFacet,
  measurementSet: selectedFacet,
  ownerId: facetSearchValue,
  ownerIdIsNull: selectedFacet,
  ownerIdSet: selectedFacet,
  sampleType: facetSearchValue,
  sampleTypeIsNull: selectedFacet,
  sampleTypeSet: selectedFacet,
  sessionName: facetSearchValue,
  sessionNameIsNull: selectedFacet,
  sessionNameSet: selectedFacet,
}

export function selectedFacetValue(
  value: string | undefined,
  selected: true | undefined,
  isNull: true | undefined
) {
  return !isNull && selected ? (value ?? "") : undefined
}
