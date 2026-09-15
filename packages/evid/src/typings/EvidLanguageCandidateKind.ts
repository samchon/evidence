/** Broad research category for a non-certified language candidate.
 *
 * `embedded-format` marks syntax normally nested inside another source artifact;
 * `programming-language` marks a potential top-level adapter. This classification
 * guides certification work and does not change an active configuration.
 */
export type EvidLanguageCandidateKind =
  "programming-language" | "embedded-format";
