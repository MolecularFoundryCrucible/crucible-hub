import { configure } from "@testing-library/react"

// The full suite runs many jsdom files in parallel; one second is too tight
// for debounced searches under that load.
configure({ asyncUtilTimeout: 3000 })
