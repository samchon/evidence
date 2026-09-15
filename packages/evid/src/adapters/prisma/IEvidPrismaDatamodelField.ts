/**
 * One resolved model member returned by Prisma's schema parser.
 *
 * This reduced parser payload contains only information that affects Evid unit
 * selection, documentation, and fingerprints.
 */
export interface IEvidPrismaDatamodelField {
  /**
   * Parser-resolved field name within its owning model.
   *
   * The loader retains this parser-approved spelling for the model member's
   * identity instead of attempting to classify source tokens independently.
   */
  name: string;

  /**
   * Parser classification used to select supported database members.
   *
   * `EvidPrismaModelLoader` maps object fields to relations and every other
   * retained field to columns when it creates the adapter's normalized field
   * contract.
   */
  kind: string;

  /**
   * Parser-attached documentation, when source supplied it.
   *
   * `null` and omission both mean no parser documentation is available.
   */
  documentation?: string | null;
}
