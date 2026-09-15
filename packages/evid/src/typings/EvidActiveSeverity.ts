/** Diagnostic severities that leave an obligation enabled in a resolved plan.
 *
 * Configuration planning drops `off` entries before graph evaluation. The two
 * remaining values differ in report severity, but both retain their population
 * in the denominator and can make a check fail according to policy.
 */
export type EvidActiveSeverity = "warning" | "error";
