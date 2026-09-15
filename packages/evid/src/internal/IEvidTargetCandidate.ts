import type { IEvidAddress } from "../structures/IEvidAddress";
import type { IEvidResolution } from "../structures/IEvidResolution";

/**
 * Public address paired with its exact inventory lookup result.
 *
 * Target resolution can derive several addresses from a host's retained
 * origins. Keeping each address beside its lookup outcome permits candidate
 * aggregation without losing which spelling produced a visible, hidden, or
 * missing match.
 */
export interface IEvidTargetCandidate {
  /**
   * Concrete public file key and accessor segments submitted to inventory
   * lookup.
   *
   * This is already parsed under the applicable artifact target grammar.
   */
  address: IEvidAddress;

  /**
   * Lookup outcome within the selected reference's structural scope.
   *
   * The resolver combines candidates by semantic identity before deciding
   * uniqueness.
   */
  resolution: IEvidResolution;
}
