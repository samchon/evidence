/**
 * Nearest package metadata relevant to the configuration evaluator's module decision.
 *
 * `configModule` reads this parsed projection while walking upward from a config
 * file. It models only the package field that can change the temporary
 * evaluator project's compiler module kind.
 */
export interface IEvidConfigPackageScope {
  /**
   * EvidNode package module mode at this package boundary.
   *
   * The evaluator selects `ESNext` only when this value is `"module"`; omission
   * and every other value retain the CommonJS fallback for an unqualified config.
   */
  type?: string;
}
