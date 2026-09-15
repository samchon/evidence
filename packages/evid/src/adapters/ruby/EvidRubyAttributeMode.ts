/**
 * Classifies the accessor capability declared by a supported Ruby attribute macro.
 *
 * EvidRubyFileScanner emits one declaration for each generated reader or writer. EvidRubyAdapterBase
 * uses this distinction to detect redefinitions without executing the macro.
 */
export type EvidRubyAttributeMode = "read" | "write";
