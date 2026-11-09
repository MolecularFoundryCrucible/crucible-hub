export function formatSignInMethods(methods: readonly string[]) {
  return methods
    .map((method) => (method === "password" ? "Password" : method))
    .join(", ")
}
