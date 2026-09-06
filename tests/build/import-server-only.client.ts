import { createCrucibleClient } from "../../src/server/crucible/client.server"

createCrucibleClient({
  baseUrl: "https://invalid.example",
  bearerToken: "probe",
})
