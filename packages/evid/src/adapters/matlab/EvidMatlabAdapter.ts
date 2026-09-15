import { EvidMatlabAdapterBase } from "./EvidMatlabAdapterBase";

/**
 * Extracts textual MATLAB classes and primary functions with class-folder ownership.
 *
 * Snapshot-wide ownership attaches external methods to their class and merges
 * accessors with declared properties. Package and class segments remain explicit
 * in public paths. Eligible percent-line help comments provide source-mapped
 * evidence rather than treating arbitrary executable strings as documentation.
 *
 * Runtime path mutation, dynamic properties, legacy classes, inherited or generated
 * members, Octave extensions, and binary or live scripts are outside the supported
 * text-source population.
 */
export class EvidMatlabAdapter extends EvidMatlabAdapterBase {}
