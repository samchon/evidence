/**
 * Classifies the accessor capability declared by a supported Ruby attribute macro.
 *
 * RubyFileScanner emits one declaration for each generated reader or writer. RubyAdapter
 * uses this distinction to detect redefinitions without executing the macro.
 */
export type RubyAttributeMode = "read" | "write";
