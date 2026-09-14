/** Whether a check had complete enough input to make a coverage decision.
 *
 * `incomplete` protects callers from treating an interrupted scan, failed
 * dependency, or unavailable parser result as a successful empty population.
 * `complete` says evaluation reached a final result; it does not itself mean
 * that every obligation passed.
 */
export type EvidenceCheckStatus = "complete" | "incomplete";
