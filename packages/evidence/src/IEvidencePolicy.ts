import type { TEvidenceDeclarationKind } from "./TEvidenceDeclarationKind";

/**
 * One "declarations here must cite sections there" obligation.
 *
 * Both globs are project-relative and support `**`, `*`, and `?`. A directory
 * entry includes everything below it, so `src/providers`, `src/providers/`, and
 * `src/providers/**` govern the same subtree. Matching is case-sensitive even
 * on a case-insensitive filesystem, because a path has one true spelling.
 */
export interface IEvidencePolicy {
  /**
   * Source files this policy governs.
   *
   * An empty or missing list matches nothing, never everything. A policy that
   * lost its globs goes quiet rather than placing the whole repository under
   * obligation.
   */
  files: readonly string[];

  /**
   * Documents whose sections discharge this obligation.
   *
   * A declaration satisfies the policy when at least one of its `@evidence`
   * tags cites a **section** of a document matching one of these globs.
   *
   * Only document sections count. A symbol citation is still checked for
   * integrity by `evidence/reference`, but it cannot ground a declaration: a
   * symbol both cites and is cited, so two declarations naming each other would
   * satisfy every obligation between them while proving nothing. A section is
   * terminal, which is what makes it grounds.
   */
  targets: readonly string[];

  /**
   * Declaration kinds under obligation.
   *
   * Defaults to `["interface", "type", "class", "function", "enum"]` — the
   * declarations that carry a design decision. `variable` and `namespace` are
   * opt-in because most are plumbing, and demanding grounds for every exported
   * constant trains authors to write filler, which is worse than demanding
   * nothing.
   *
   * Only exported, top-level declarations are ever obliged. A module-private
   * declaration is an implementation detail of something already under
   * obligation.
   */
  kinds?: readonly TEvidenceDeclarationKind[];

  /**
   * Replaces the default diagnostic.
   *
   * Prefer the default. It distinguishes "cited nothing" from "cited the wrong
   * place" — two mistakes with the same symptom and different repairs — and a
   * fixed string collapses them back together.
   */
  message?: string;
}
