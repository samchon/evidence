import type { IEvidencePolicy } from "./IEvidencePolicy";

/**
 * Requires declarations in configured folders to cite a document section under
 * configured folders.
 *
 * This is the source-side question, and it is a third question rather than a
 * variant of the other two. `evidence/reference` asks whether a citation points
 * at something real. A coverage rule would ask which declared section nothing
 * has proven. This asks which declaration asserts something while citing
 * nothing at all.
 *
 * Configure this rule once, in a single entry, with every policy in the
 * `policies` array. Splitting policies across config entries does not
 * accumulate and does not warn: a rule setting has no `files` key at all
 * (`files` lives only on the top-level config object), a config file is one
 * object rather than an array, and `extends` takes a single string — so one
 * config file contributes at most one rules entry, and where two do match, the
 * later entry's options replace the earlier outright.
 *
 * Adoption is authorship, not configuration. Enabling a broad policy on an
 * existing codebase produces hundreds of errors at once, and the cheapest way
 * to clear them is to write a plausible citation on each — which yields a graph
 * that is fully covered, largely false, and permanently indistinguishable from
 * a real one. Start from a folder small enough to cite honestly and widen the
 * glob deliberately. The glob is the ratchet: it is diffable, reviewable, and
 * states which folders are under discipline.
 */
export interface IEvidenceRequireOptions {
  /**
   * Citation obligations. Every matching policy applies: they are demands, not
   * allow/deny effects, so they compose rather than shadow. A declaration
   * selected by two policies must satisfy both.
   */
  policies?: readonly IEvidencePolicy[];
}
