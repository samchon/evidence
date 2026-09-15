/**
 * Physical and checkout-stable identities of one source population root.
 *
 * Adapters can retain the physical root in process-local unit IDs while review
 * fingerprints replace it with the configured logical path carried here.
 */
export interface IEvidSourceFingerprintRoot {
  /**
   * Canonical filesystem directory used by the adapter during this analysis.
   *
   * Symlink and junction resolution may make this differ from the configured
   * logical root even though both identify the same selected population.
   */
  physicalPath: string;

  /**
   * Configuration-relative logical path that identifies the population root.
   *
   * This path moves with a checkout and still distinguishes separately declared
   * roots within the same Evid configuration.
   */
  fingerprintPath: string;
}
