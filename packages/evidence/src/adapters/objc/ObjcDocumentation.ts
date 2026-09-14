import { CDocumentation } from "../c/CDocumentation";

/**
 * Objective-C uses the same mapped Doxygen carriers and example masking as C.
 *
 * The shared reader preserves source offsets while preventing example text from
 * being interpreted as Evidence annotations on an Objective-C declaration.
 */
export const ObjcDocumentation = CDocumentation;
