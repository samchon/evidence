import { EvidDartAdapterBase } from "./EvidDartAdapterBase";

/**
 * Extracts Dart public declarations across defining libraries, parts, and
 * static exports.
 *
 * Library resolution checks reciprocal part ownership before publishing
 * aliases. Supported show/hide exports project public paths without changing
 * the defining declaration's semantic identity. Attached Dart documentation
 * remains associated with its original declaration site through these
 * projections.
 *
 * Package and SDK export URIs, conditional exports, augmentation, and members
 * absent from selected source are outside this boundary. Missing part
 * dependencies remain observable so watch can recover when their source
 * appears.
 */
export class EvidDartAdapter extends EvidDartAdapterBase {}
