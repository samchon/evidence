import type { EvidArtifactType } from "../typings/EvidArtifactType";
import type { IEvidInventory } from "./IEvidInventory";
import type { IEvidSourceSnapshot } from "./IEvidSourceSnapshot";

/**
 * Language-specific extraction boundary between source discovery and graph evaluation.
 *
 * The checker supplies a captured source snapshot. The adapter owns declaration
 * classification, visibility, semantic ownership, public addresses, and comment
 * attachment for its artifact. Shared graph code consumes the resulting records
 * without interpreting that language's syntax.
 *
 * Grammar acceptance alone does not establish complete support. Constructs that
 * can alter the public population but cannot be analyzed must leave an incomplete
 * inventory with a repairable diagnostic. Source failures and watch dependencies
 * also cross this boundary; borrowed parser resources must not escape in output.
 *
 * @example
 * const adapter: IEvidAdapter = new EvidTypeScriptAdapter();
 * const inventory: IEvidInventory = await adapter.analyze(snapshot);
 * // An incomplete inventory must not be accepted as a smaller full population.
 */
export interface IEvidAdapter {
  /**
   * Artifact language or format handled by this adapter.
   *
   * Configuration and the adapter factory use this discriminator to choose
   * extraction rules. The same adapter supports claim and reference populations.
   */
  type: EvidArtifactType;

  /**
   * Extracts serializable declaration and documentation records from a snapshot.
   *
   * Preserve discovery failures and report unsupported surface-changing syntax
   * instead of silently omitting its declarations. Returned ranges and content
   * must refer to the supplied snapshots, with native resources released before
   * the result is consumed by inventory reconciliation.
   */
  analyze(snapshot: IEvidSourceSnapshot): Promise<IEvidInventory>;
}
