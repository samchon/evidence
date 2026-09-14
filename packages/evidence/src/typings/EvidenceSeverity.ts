/** Configured severity for one claim or reference obligation.
 *
 * `off` removes the entry during plan construction. `warning` and `error` keep
 * it active and control the diagnostic level emitted when evaluation finds an
 * unmet obligation; they are represented separately by `EvidenceActiveSeverity`.
 */
export type EvidenceSeverity = "off" | "warning" | "error";
