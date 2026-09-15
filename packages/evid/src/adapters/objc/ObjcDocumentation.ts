import { EvidCDocumentation } from "../c/EvidCDocumentation";

/**
 * Objective-C uses the same mapped Doxygen carriers and example masking as C.
 *
 * The shared reader preserves source offsets while preventing example text from
 * being interpreted as Evid annotations on an Objective-C declaration.
 */
export const ObjcDocumentation = EvidCDocumentation;
