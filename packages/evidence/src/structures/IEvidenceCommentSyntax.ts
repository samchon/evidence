/** Delimiters supplied after an adapter has classified a real documentation comment. */
export interface IEvidenceCommentSyntax {
  opening: string;
  closing: string;
  linePrefix?: string;
  tagBoundaries: boolean;
  allowWithdrawal: boolean;
}
