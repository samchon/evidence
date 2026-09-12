/** Coverage retained for one semantic claim host in a Markdown checklist. */
export interface IEvidenceGraphHostCoverage {
  /** Semantic claim host owning this coverage ledger. */
  hostUnitId: string;
  /** Selected reference units answered by this host. */
  coveredUnitIds: string[];
  /** Selected reference units still unanswered by this host. */
  missingUnitIds: string[];
  /** Missing units already explained by a direct aggregate diagnostic. */
  explainedUnitIds: string[];
}
