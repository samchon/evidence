/** One resolved model member returned by Prisma's schema parser.
 *
 * This reduced parser payload contains only information that affects Evidence
 * unit selection, documentation, and fingerprints.
 */
export interface IPrismaDatamodelField {
  /** Parser-resolved field name within its owning model. */
  name: string;

  /** Parser classification used to select supported database members. */
  kind: string;

  /** Parser-attached documentation, when source supplied it.
   *
   * `null` and omission both mean no parser documentation is available.
   */
  documentation?: string | null;
}
