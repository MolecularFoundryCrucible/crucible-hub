import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookies } from "@tanstack/react-start/server"

import {
  parseViewerPresentation,
  readDocumentCookies,
} from "./viewer-presentation"

export const readViewerPresentation = createIsomorphicFn()
  .server(() => parseViewerPresentation(getCookies()))
  .client(() => parseViewerPresentation(readDocumentCookies()))
