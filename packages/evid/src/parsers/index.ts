/**
 * Parser sessions, documentation tags, and certified language registry access.
 *
 * Adapter implementations use these boundaries to parse supported artifacts and
 * interpret evidence annotations without importing command execution.
 */
export * from "./EvidDocumentation";
export * from "./EvidDocumentationExamples";
export * from "./EvidLanguageRegistry";
export * from "./EvidParser";
export * from "./EvidParserError";
export type { EvidParseSession } from "./EvidParseSession";
export * from "./EvidTagParser";
