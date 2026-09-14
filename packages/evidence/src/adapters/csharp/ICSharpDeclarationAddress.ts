/** One C# address candidate and whether it is the canonical identity spelling. */
export interface ICSharpDeclarationAddress {
  segments: string[];
  canonical: boolean;
  aliasPrefixes: string[][];
}
