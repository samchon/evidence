import { EvidJavaAdapterBase } from "./EvidJavaAdapterBase";

/**
 * Extracts Java source-public declarations and attached Javadoc from selected files.
 *
 * Analysis publishes top-level and nested types with methods grouped by owner and
 * name. Its boundary is explicit source visibility, independent of JPMS package
 * export enforcement. Overload sites remain available for documentation ownership
 * even when they contribute to one semantic method family.
 *
 * The adapter does not execute annotation processors or synthesize inherited,
 * record, or enum methods absent from source. Supply generated source explicitly
 * when those declarations belong in the configured population.
 */
export class EvidJavaAdapter extends EvidJavaAdapterBase {}
