import { PhpAdapter } from "./PhpAdapter";

/**
 * Extracts explicit namespaces and public members from tagged PHP source.
 *
 * Attached PHPDoc is mapped to declaration hosts before graph tags are parsed.
 * Public paths retain namespace and owner boundaries. Property names keep their
 * leading dollar sign, while methods and constants do not, so target construction
 * must preserve the language's spelling rather than strip punctuation globally.
 *
 * Tagless input, trait composition, conditional declarations, runtime includes,
 * autoload discovery, and generated or inherited members are outside this source
 * boundary. The adapter does not execute PHP to discover a larger surface.
 */
export class EvidencePhpAdapter extends PhpAdapter {}
