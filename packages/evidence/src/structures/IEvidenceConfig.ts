import type { EvidenceSeverity } from "../typings/EvidenceSeverity";
import type { IEvidenceClaim } from "./IEvidenceClaim";

/**
 * Configuration declaring the project's claims and required Evidence
 * populations.
 *
 * Each claim selects declarations that may carry Evidence and references the
 * populations they must acknowledge. Artifact families can differ across that
 * boundary: TypeScript implementation may answer Markdown requirements, while
 * another claim requires tests to acknowledge the implementation.
 *
 * The loader validates all declarations, resolves severity and selector
 * defaults, then removes inactive populations from the execution plan. Relative
 * roots are anchored to the configuration file. Repeated references remain
 * independent obligations even when they select identical files.
 *
 * @example
 *   const config: IEvidenceConfig = {
 *     claims: [
 *       {
 *         type: "typescript",
 *         files: ["src/*.ts"],
 *         reference: {
 *           type: "markdown",
 *           files: ["requirements.md"],
 *           symbol: "h2",
 *         },
 *       },
 *     ],
 *   };
 */
export interface IEvidenceConfig {
  /**
   * Root diagnostic severity inherited by claims and their references.
   *
   * Omission uses error severity. A claim or reference can override its
   * inherited value; off populations are validated but omitted from
   * materialization.
   *
   * @default error
   */
  severity?: EvidenceSeverity | undefined;

  /**
   * Claim selections and the Evidence each must acknowledge.
   *
   * At least one claim is required. Each reference inside each claim creates an
   * independent obligation; shared names or files never pool their coverage.
   */
  claims: IEvidenceClaim[];
}
