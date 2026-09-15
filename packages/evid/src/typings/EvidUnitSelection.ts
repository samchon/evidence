/**
 * Relationship between an inventory unit and a configured population.
 *
 * `selected` units form the coverage denominator. `ancestor` units remain
 * addressable to cover selected descendants but do not count themselves, while
 * `unselected` units are outside that population's target space altogether.
 */
export type EvidUnitSelection = "selected" | "ancestor" | "unselected";
