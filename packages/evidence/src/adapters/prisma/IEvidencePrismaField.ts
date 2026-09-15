import type { EvidenceDatabaseSymbol } from "../../typings/EvidenceDatabaseSymbol";

/**
 * One parser-classified Prisma model member.
 *
 * These detached records make the cross-file materializer independent of the
 * WASM parser lifetime while preserving the member fingerprint boundary.
 */
export interface IEvidencePrismaField {
  /**
   * Name relative to the owning model identity.
   *
   * The materializer joins it with its containing model name to create the
   * public address and semantic identity for this member.
   */
  name: string;

  /**
   * Evidence unit symbol selected from the parser field kind.
   *
   * Prisma scalar fields become columns and object fields become relations, so
   * this normalized symbol controls selector matching without retaining WASM
   * data.
   */
  symbol: Exclude<EvidenceDatabaseSymbol, "model">;

  /**
   * Documentation text used to recover directive and withdrawal state.
   *
   * The adapter parses this detached text after it establishes the field's
   * host, keeping comment metadata separate from the semantic fingerprint
   * payload.
   */
  documentation: string;

  /**
   * Semantic field digest excluding documentation metadata.
   *
   * Review fingerprints use this value to detect changes to the field itself
   * without treating explanatory or Evidence annotation edits as semantic drift.
   */
  digest: string;
}
