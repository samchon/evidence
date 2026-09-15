import type { EvidSeverity } from "../typings/EvidSeverity";
import type { IEvidClaim } from "./IEvidClaim";

/**
 * Configuration declaring the project's claims and required evidence populations.
 *
 * Each claim selects declarations that may carry evidence and references the
 * populations they must acknowledge. Artifact families can differ across that
 * boundary: TypeScript implementation may answer Markdown requirements, while
 * another claim requires tests to acknowledge the implementation.
 *
 * The loader validates all declarations, resolves severity and selector defaults,
 * then removes inactive populations from the execution plan. Relative roots are
 * anchored to the configuration file. Repeated references remain independent
 * obligations even when they select identical files.
 *
 * @example
 * const config: IEvidConfig = {
 *   claims: [{
 *     type: "typescript",
 *     files: ["src/*.ts"],
 *     reference: { type: "markdown", files: ["requirements.md"], symbol: "h2" },
 *   }],
 * };
 */
export interface IEvidConfig {
  /**
   * Root diagnostic severity inherited by claims and their references.
   *
   * Omission uses error severity. A claim or reference can override its inherited
   * value; off populations are validated but omitted from materialization.
   *
   * @default error
   */
  severity?: EvidSeverity | undefined;

  /**
   * Claim selections and the evidence each must acknowledge.
   *
   * At least one claim is required. Each reference inside each claim creates an
   * independent obligation; shared names or files never pool their coverage.
   */
  claims: IEvidClaim[];
}
