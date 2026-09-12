/** File selection shared by claim and reference populations. */
export interface IEvidenceSourceSelection {
  /** Directory resolved from the configuration file's directory. */
  root?: string;

  /** Ordered root-relative globs using the claim files contract. */
  files: string[];
}
