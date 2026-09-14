/** The side of an Evidence obligation to which a configured population belongs.
 *
 * A claim population provides units requiring coverage. A reference population
 * provides targets that can satisfy those units. The same source may appear on
 * both sides, but planning keeps their roles separate for validation and scope.
 */
export type EvidencePopulationRole = "claim" | "reference";
