/**
 * Public package API.
 *
 * Importing this entry point registers no parser work, configuration loading, or
 * command execution. Consumers choose explicit checker, command, loader, and
 * adapter entry points for their own execution boundary.
 */
export { EvidenceDartAdapter } from "./adapters/dart/EvidenceDartAdapter";
export { EvidenceScalaAdapter } from "./adapters/scala/EvidenceScalaAdapter";
export { EvidenceChecker } from "./EvidenceChecker";

/**
 * Exports certified adapters for supported programming and database artifacts.
 *
 * Consumers select these adapters when constructing an explicit parsing boundary;
 * configuration-driven checks use the package registry to select them by artifact
 * type instead.
 */
export { EvidenceCAdapter } from "./adapters/c/EvidenceCAdapter";
export { EvidenceBigQueryAdapter } from "./adapters/bigquery/EvidenceBigQueryAdapter";
export { EvidenceCppAdapter } from "./adapters/cpp/EvidenceCppAdapter";
export { EvidenceCSharpAdapter } from "./adapters/csharp/EvidenceCSharpAdapter";
export { EvidenceDbmlAdapter } from "./adapters/dbml/EvidenceDbmlAdapter";
export { EvidenceGoAdapter } from "./adapters/go/EvidenceGoAdapter";
export { EvidenceJavaAdapter } from "./adapters/java/EvidenceJavaAdapter";
export { EvidenceJavaScriptAdapter } from "./adapters/javascript/EvidenceJavaScriptAdapter";
export { EvidenceKotlinAdapter } from "./adapters/kotlin/EvidenceKotlinAdapter";
export { EvidenceLuaAdapter } from "./adapters/lua/EvidenceLuaAdapter";
export { EvidenceSqliteAdapter } from "./adapters/sqlite/EvidenceSqliteAdapter";
export { EvidenceMarkdownAdapter } from "./adapters/markdown/EvidenceMarkdownAdapter";
export { EvidenceMatlabAdapter } from "./adapters/matlab/EvidenceMatlabAdapter";
export { EvidencePhpAdapter } from "./adapters/php/EvidencePhpAdapter";
export { EvidenceMysqlAdapter } from "./adapters/mysql/EvidenceMysqlAdapter";
export { EvidencePrismaAdapter } from "./adapters/prisma/EvidencePrismaAdapter";
export { EvidencePostgresqlAdapter } from "./adapters/postgresql/EvidencePostgresqlAdapter";
export { EvidencePythonAdapter } from "./adapters/python/EvidencePythonAdapter";
export { EvidenceRubyAdapter } from "./adapters/ruby/EvidenceRubyAdapter";
export { EvidenceRustAdapter } from "./adapters/rust/EvidenceRustAdapter";
export { EvidenceSqlAdapter } from "./adapters/sql/EvidenceSqlAdapter";
export { EvidenceSwiftAdapter } from "./adapters/swift/EvidenceSwiftAdapter";
export { EvidenceSwaggerAdapter } from "./adapters/swagger/EvidenceSwaggerAdapter";
export { EvidenceTypeScriptAdapter } from "./adapters/typescript/EvidenceTypeScriptAdapter";
export { EvidenceZigAdapter } from "./adapters/zig/EvidenceZigAdapter";

/**
 * Exports command execution, watch lifecycle, and command syntax boundaries.
 *
 * Use EvidenceCommand for CLI-compatible finite execution, EvidenceWatcher for
 * long-lived publication, and EvidenceCommandError to distinguish invalid syntax
 * before a project configuration is loaded.
 */
export { EvidenceCommand } from "./commands/EvidenceCommand";
export { EvidenceCommandError } from "./commands/EvidenceCommandError";
export { EvidenceWatcher } from "./commands/EvidenceWatcher";

/**
 * Exports graph construction, semantic inventory, and query projections.
 *
 * These APIs consume a captured check analysis to resolve semantic identities,
 * coverage, reviews, and human- or machine-facing query results consistently.
 */
export { EvidenceFingerprint } from "./graph/EvidenceFingerprint";
export { EvidenceGraph } from "./graph/EvidenceGraph";
export { EvidenceInventory } from "./graph/EvidenceInventory";
export { EvidenceQuery } from "./graph/EvidenceQuery";

/**
 * Exports configuration and local-source loading boundaries.
 *
 * EvidenceChecker composes these loaders for normal checks, while integrations
 * can call them directly when they need validated configuration or snapshots.
 */
export { EvidenceConfigLoader } from "./loaders/EvidenceConfigLoader";
export { EvidenceSourceLoader } from "./loaders/EvidenceSourceLoader";

/**
 * Exports parser sessions, documentation tags, and certified language registry access.
 *
 * Adapter implementations use these boundaries to parse supported artifacts and
 * interpret evidence annotations without importing the command execution layer.
 */
export { EvidenceDocumentation } from "./parsers/EvidenceDocumentation";
export { EvidenceLanguageRegistry } from "./parsers/EvidenceLanguageRegistry";
export { EvidenceParser } from "./parsers/EvidenceParser";
export { EvidenceParserError } from "./parsers/EvidenceParserError";
export type { EvidenceParseSession } from "./parsers/EvidenceParseSession";
export { EvidenceTagParser } from "./parsers/EvidenceTagParser";

/**
 * Exports serializers for check, query, graph, and watch reports.
 *
 * They project already evaluated report objects into text, JSON, or graph formats
 * without changing the underlying inventory, diagnostics, or exit semantics.
 */
export { EvidenceGraphReporter } from "./reporters/EvidenceGraphReporter";
export { EvidenceQueryReporter } from "./reporters/EvidenceQueryReporter";
export { EvidenceReporter } from "./reporters/EvidenceReporter";
export { EvidenceWatchReporter } from "./reporters/EvidenceWatchReporter";

/**
 * Exports target parsing and resolution utilities.
 *
 * Query and annotation consumers use them to preserve literal accessor spelling,
 * normalize file addresses, and resolve targets within selected populations.
 */
export { EvidenceAccessor } from "./targets/EvidenceAccessor";
export { EvidenceFileTarget } from "./targets/EvidenceFileTarget";
export { EvidenceTargetResolver } from "./targets/EvidenceTargetResolver";

/**
 * Re-exports public configuration, report, source, and semantic contract types.
 *
 * These type-only exports define the values exchanged by checker, command, loader,
 * and query APIs without adding runtime work to a package import.
 */
export type * from "./structures";
export type * from "./typings";
export { EvidenceObjcAdapter } from "./adapters/objc/EvidenceObjcAdapter";
