/** A filesystem location whose changes can invalidate a discovery result. */
export interface IEvidenceSourceDependency {
  /** Absolute logical or physical path, including missing paths. */
  path: string;

  /** Watch descendants as well as this path; false denotes an exact dependency. */
  recursive: boolean;
}
