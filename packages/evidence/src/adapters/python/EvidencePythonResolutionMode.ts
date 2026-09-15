/**
 * Selects whether a Python lookup is constrained by a module's public surface.
 *
 * Star imports require public lookup, whereas named imports may resolve a
 * declared module attribute even when that name is not publicly re-exported.
 */
export type EvidencePythonResolutionMode = "public" | "declared";
