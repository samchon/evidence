/** One line-start annotation and its continued body within normalized documentation. */
export interface IPendingEvidenceTag {
  kind:
    | "evidence"
    | "link"
    | "evidenceExclude"
    | "evidenceReview"
    | "evidenceExcludeReview";
  body: string;
  start: number;
  end: number;
}
