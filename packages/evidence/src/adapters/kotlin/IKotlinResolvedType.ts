/** A resolved nominal receiver and its effective nullability. */
export interface IKotlinResolvedType {
  /** Canonical package and declared owner segments. */
  segments: string[];

  /** Nullable receiver status, including selected type-alias expansion. */
  nullable: boolean;
}
