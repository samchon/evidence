import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";

/**
 * Associates one scanned Python declaration with module binding information.
 *
 * Export resolution matches `roots` before it publishes the unit, then prefixes
 * `suffix` with each reachable public path. This prevents an internal alias
 * from changing the declaration's semantic ID.
 */
export interface IPythonOwnedUnit {
  /**
   * Evidence unit with semantic identity, source position, and parent relation.
   *
   * The adapter publishes only units reachable from a supported module export.
   */
  unit: IEvidenceUnit;

  /**
   * Module-level binding names that can resolve to this declaration.
   *
   * A declaration can have more than one root when Python syntax establishes
   * aliases without creating a separate semantic unit.
   */
  roots: string[];

  /**
   * Address segments beneath the matching module root.
   *
   * Instance members include the adapter's prototype marker while class members
   * remain direct children of their class address.
   */
  suffix: string[];
}
