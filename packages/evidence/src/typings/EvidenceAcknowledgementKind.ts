/**
 * Distinguishes an ordinary citation from an acknowledged exclusion.
 *
 * Both forms attach authored context to a graph obligation, but only `evidence`
 * supplies coverage. `evidenceExclude` records an intentional exception and
 * therefore follows the exclusion and review rules instead of crediting a
 * unit.
 */
export type EvidenceAcknowledgementKind = "evidence" | "evidenceExclude";
