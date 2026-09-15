import { EvidObjcAdapterBase } from "./EvidObjcAdapterBase";

/**
 * Extracts explicit Objective-C interfaces, protocols, categories, and public members.
 *
 * Analysis includes declared properties, public ivars, and external C functions
 * and attaches supported Doxygen to their physical sites. Protocol and category
 * names remain literal owner segments. Method selectors preserve their plus or
 * minus prefix and every colon, keeping class and instance methods distinguishable.
 *
 * Objective-C++, preprocessing, include traversal, external C aggregate/data
 * declarations, compatibility aliases, and inherited or synthesized declarations
 * are outside this selected-source boundary.
 */
export class EvidObjcAdapter extends EvidObjcAdapterBase {}
