import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";

/** One parser-classified Prisma model member.
 *
 * These detached records make the cross-file materializer independent of the
 * WASM parser lifetime while preserving the member fingerprint boundary.
 */
export interface IPrismaField {
  /** Name relative to the owning model identity. */
  name: string;

  /** Evidence unit symbol selected from the parser field kind. */
  symbol: Exclude<EvidenceDatabaseSymbol, "model">;

  /** Documentation text used to recover directive and withdrawal state. */
  documentation: string;

  /** Semantic field digest excluding documentation metadata. */
  digest: string;
}
