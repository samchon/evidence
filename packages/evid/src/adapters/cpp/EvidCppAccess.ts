/**
 * Represents the access section currently governing a C++ member declaration.
 *
 * EvidCppFileScanner carries this value through nested records so their visibility
 * can account for both the member's section and its containing type.
 */
export type EvidCppAccess = "public" | "protected" | "private";
