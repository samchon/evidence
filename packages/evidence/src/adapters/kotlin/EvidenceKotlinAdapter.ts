import { KotlinAdapter } from "./KotlinAdapter";

/**
 * Extracts explicit public Kotlin declarations and receiver-qualified extensions.
 *
 * Analysis resolves supported nominal aliases and extension receivers across the
 * selected snapshot while retaining file-private and lexical ownership. Public
 * paths expose explicit companion owners and receiver segments; attached KDoc
 * supplies evidence without importing a compiler's generated member population.
 *
 * Scripts, expect/actual composition, delegated members, implicit override
 * visibility, and generic or unresolved extension receivers are not inferred.
 * Those boundaries must remain visible when they affect public completeness.
 */
export class EvidenceKotlinAdapter extends KotlinAdapter {}
