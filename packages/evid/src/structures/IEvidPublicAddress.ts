import type { IEvidAddress } from "./IEvidAddress";

/**
 * A public citation address associated with one semantic declaration.
 *
 * Adapters publish direct paths and supported aliases or re-exports in this
 * shape. Keeping the unit ID separate from the inherited file and accessor lets
 * resolution preserve every public spelling without duplicating coverage
 * units.
 *
 * An address exposes a declaration but does not establish its structural owner.
 * Parent relationships remain on the unit, even when an alias changes the
 * apparent nesting of the public path.
 */
export interface IEvidPublicAddress extends IEvidAddress {
  /**
   * Semantic identity exposed through the inherited address.
   *
   * The ID must exist in the inventory. Multiple addresses may share it; an
   * exact address associated with different IDs remains an ambiguous target.
   */
  unitId: string;
}
