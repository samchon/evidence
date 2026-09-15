/**
 * Parser sessions, documentation tags, and certified language registry access.
 *
 * Adapter implementations use these boundaries to parse supported artifacts and
 * interpret evidence annotations without importing command execution.
 */
export * from "./EvidenceDocumentation";
export * from "./EvidenceDocumentationExamples";
export * from "./EvidenceLanguageRegistry";
export * from "./EvidenceParser";
export * from "./EvidenceParserError";
export type { EvidenceParseSession } from "./EvidenceParseSession";
export * from "./EvidenceTagParser";
