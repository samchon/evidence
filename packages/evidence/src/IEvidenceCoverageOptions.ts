/**
 * Reports declared sections that nothing cites.
 *
 * This is the target-side question, the third of three. `evidence/reference`
 * asks whether a citation points at something real; `evidence/require` asks
 * whether a declaration asserts something while citing nothing; this asks which
 * section of the design nothing in the code claims to implement.
 *
 * Its blindness is structural: it counts sections with no citation, so it can
 * never see a citation with no section. That is `evidence/reference`'s job.
 * Enabling one does not cover the other.
 *
 * Project-scoped, so it must be configured in an entry with no `files` key. Its
 * findings name a markdown section and therefore carry no file and no line — a
 * section has no TypeScript node to point at.
 *
 * A section that genuinely needs no citation says so in the document, under its
 * heading:
 *
 * ```md
 * ## Naming Conventions
 *
 * <!-- evidence-exempt: describes a convention, not behavior anything implements -->
 * ```
 *
 * The reason is mandatory; a marker with a blank reason is an error rather than
 * an exemption. The marker lives in the document because that is where the
 * uncited thing lives, and it is an HTML comment so it stays invisible in every
 * renderer while remaining reviewable in the source.
 */
export interface IEvidenceCoverageOptions {
  /**
   * Documents whose sections must be cited. Required and non-empty.
   *
   * Coverage cannot inherit the index rule's scope because project rules cannot
   * read one another's options. An implicit whole-repository default would
   * instead demand citations for unrelated READMEs and guides while appearing
   * to share the index's scope.
   *
   * Narrow this rather than exempting sections one by one when a whole document
   * is reference material. Adoption is authorship: a small demanded set that is
   * honestly covered beats a large one cleared by citations written to silence
   * errors.
   */
  documents: readonly [string, ...string[]];
}
