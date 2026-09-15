/**
 * Per-host answer ledger for a Markdown checklist obligation.
 *
 * Checklist mode requires each semantic claim host to answer the selected
 * reference items. Keeping these ledgers separate prevents one host's answer
 * from hiding another host's omissions. Explained IDs suppress redundant missing
 * messages when a more direct aggregate diagnostic already describes the failure.
 */
export interface IEvidGraphHostCoverage {
  /**
   * Semantic claim unit that owes the checklist answers.
   *
   * This identifies the subject being checked, rather than a physical comment
   * position that may carry statements for several units.
   */
  hostUnitId: string;

  /**
   * Selected reference identities answered by this host.
   *
   * An answer contributes here only under this obligation's acknowledgement policy.
   */
  coveredUnitIds: string[];

  /**
   * Selected reference identities still unanswered by this host.
   *
   * Another host's coverage does not remove an identity from this list.
   */
  missingUnitIds: string[];

  /**
   * Missing identities already attributed to a direct aggregate diagnostic.
   *
   * These remain missing coverage; the marker prevents duplicate explanations
   * during checklist finalization.
   */
  explainedUnitIds: string[];
}
