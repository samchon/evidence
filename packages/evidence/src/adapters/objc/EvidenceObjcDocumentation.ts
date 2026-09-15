import { EvidenceCDocumentation } from "../c/EvidenceCDocumentation";

/**
 * Objective-C uses the same mapped Doxygen carriers and example masking as C.
 *
 * The shared reader preserves source offsets while preventing example text from
 * being interpreted as evidence annotations on an Objective-C declaration.
 */
export const EvidenceObjcDocumentation = EvidenceCDocumentation;
