import type { IEvidSourceLocation } from "./IEvidSourceLocation";

/**
 * Annotation-carrier node used when a relationship has no semantic claim
 * endpoint.
 *
 * Some eligible carriers, including file-level exclusions, have no selected
 * claim unit. Export retains their physical host as an endpoint so the
 * relationship does not disappear or invent a semantic declaration solely for
 * visualization.
 */
export interface IEvidGraphHostNode {
  /**
   * Export identity qualified by obligation and physical host.
   *
   * Source endpoint lists use it when no semantic claim-node IDs are available.
   */
  id: string;

  /**
   * Independent obligation containing the carrier relationship.
   *
   * Another reference can represent the same physical host under a different
   * node ID.
   */
  boundaryId: string;

  /**
   * Discriminator identifying a carrier rather than a semantic-unit node.
   *
   * Consumers use this role before reading host-specific location fields.
   */
  role: "host";

  /**
   * Extracted documentation-host identity.
   *
   * This links the endpoint back to acknowledgement or review source ownership.
   */
  hostId: string;

  /**
   * Display label assigned to the standalone carrier.
   *
   * The current exporter uses the host identity because no declaration name
   * exists.
   */
  name: string;

  /**
   * Original file and range of the annotation carrier.
   *
   * This provides a repair location despite the absence of a semantic claim
   * unit.
   */
  location: IEvidSourceLocation;
}
