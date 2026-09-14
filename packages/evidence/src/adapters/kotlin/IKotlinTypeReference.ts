/** Static nominal receiver lookup retained beyond the parser callback. */
export interface IKotlinTypeReference {
  /** Physical source whose private type aliases participate in lookup. */
  file: string;

  /** Lexical, explicit-import, and package paths in lookup order. */
  paths: string[][];

  /** An explicit import, qualified path, or known Kotlin core type. */
  external?: string[];

  /** Whether the source adds a nullable suffix to the receiver. */
  nullable: boolean;

  /** A type expression requiring unsupported substitution or import resolution. */
  problem?: string;
}
