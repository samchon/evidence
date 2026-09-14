/** One C address candidate and whether it uses a language namespace exactly. */
export interface ICDeclarationAddress {
  segments: string[];
  canonical: boolean;
  aliasPrefixes: string[][];
}
