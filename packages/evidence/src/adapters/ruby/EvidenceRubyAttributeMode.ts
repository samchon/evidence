/**
 * Classifies the accessor capability declared by a supported Ruby attribute
 * macro.
 *
 * EvidenceRubyFileScanner emits one declaration for each generated reader or
 * writer. EvidenceRubyAdapter uses this distinction to detect redefinitions
 * without executing the macro.
 */
export type EvidenceRubyAttributeMode = "read" | "write";
