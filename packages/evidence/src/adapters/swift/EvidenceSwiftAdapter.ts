import { SwiftAdapter } from "./SwiftAdapter";

/**
 * Extracts explicit public and open Swift declarations within one selected module.
 *
 * Local nominal extensions and protocol requirements participate in ownership
 * reconciliation before publication. Overloads group by base name, static members
 * use an explicit static segment, and attached DocC retains the declaration site
 * that owns each annotation. Separately configured module roots remain independent.
 *
 * External or constrained extensions, macro and custom-attribute expansion,
 * conditional compilation, and generated or inherited members are outside this
 * declared-source boundary.
 */
export class EvidenceSwiftAdapter extends SwiftAdapter {}
