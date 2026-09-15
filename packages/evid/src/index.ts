/**
 * Public package API.
 *
 * Importing this entry point registers no parser work, configuration loading, or
 * command execution. Consumers choose explicit checker, command, loader, and
 * adapter entry points for their own execution boundary.
 */
export { EvidDartAdapter } from "./adapters/dart/EvidDartAdapter";
export { EvidScalaAdapter } from "./adapters/scala/EvidScalaAdapter";
export { EvidChecker } from "./EvidChecker";

/**
 * Exports certified adapters for supported programming and database artifacts.
 *
 * Consumers select these adapters when constructing an explicit parsing boundary;
 * configuration-driven checks use the package registry to select them by artifact
 * type instead.
 */
export { EvidCAdapter } from "./adapters/c/EvidCAdapter";
export { EvidBigQueryAdapter } from "./adapters/bigquery/EvidBigQueryAdapter";
export { EvidCppAdapter } from "./adapters/cpp/EvidCppAdapter";
export { EvidCSharpAdapter } from "./adapters/csharp/EvidCSharpAdapter";
export { EvidDbmlAdapter } from "./adapters/dbml/EvidDbmlAdapter";
export { EvidGoAdapter } from "./adapters/go/EvidGoAdapter";
export { EvidJavaAdapter } from "./adapters/java/EvidJavaAdapter";
export { EvidJavaScriptAdapter } from "./adapters/javascript/EvidJavaScriptAdapter";
export { EvidKotlinAdapter } from "./adapters/kotlin/EvidKotlinAdapter";
export { EvidLuaAdapter } from "./adapters/lua/EvidLuaAdapter";
export { EvidSqliteAdapter } from "./adapters/sqlite/EvidSqliteAdapter";
export { EvidMarkdownAdapter } from "./adapters/markdown/EvidMarkdownAdapter";
export { EvidMatlabAdapter } from "./adapters/matlab/EvidMatlabAdapter";
export { EvidPhpAdapter } from "./adapters/php/EvidPhpAdapter";
export { EvidMysqlAdapter } from "./adapters/mysql/EvidMysqlAdapter";
export { EvidPrismaAdapter } from "./adapters/prisma/EvidPrismaAdapter";
export { EvidPostgresqlAdapter } from "./adapters/postgresql/EvidPostgresqlAdapter";
export { EvidPythonAdapter } from "./adapters/python/EvidPythonAdapter";
export { EvidRubyAdapter } from "./adapters/ruby/EvidRubyAdapter";
export { EvidRustAdapter } from "./adapters/rust/EvidRustAdapter";
export { EvidSqlAdapter } from "./adapters/sql/EvidSqlAdapter";
export { EvidSwiftAdapter } from "./adapters/swift/EvidSwiftAdapter";
export { EvidSwaggerAdapter } from "./adapters/swagger/EvidSwaggerAdapter";
export { EvidTypeScriptAdapter } from "./adapters/typescript/EvidTypeScriptAdapter";
export { EvidZigAdapter } from "./adapters/zig/EvidZigAdapter";

/**
 * Exports command execution, watch lifecycle, and command syntax boundaries.
 *
 * Use EvidCommand for CLI-compatible finite execution, EvidWatcher for
 * long-lived publication, and EvidCommandError to distinguish invalid syntax
 * before a project configuration is loaded.
 */
export { EvidCommand } from "./commands/EvidCommand";
export { EvidCommandError } from "./commands/EvidCommandError";
export { EvidWatcher } from "./commands/EvidWatcher";

/**
 * Exports graph construction, semantic inventory, and query projections.
 *
 * These APIs consume a captured check analysis to resolve semantic identities,
 * coverage, reviews, and human- or machine-facing query results consistently.
 */
export { EvidFingerprint } from "./graph/EvidFingerprint";
export { EvidGraph } from "./graph/EvidGraph";
export { EvidInventory } from "./graph/EvidInventory";
export { EvidQuery } from "./graph/EvidQuery";

/**
 * Exports configuration and local-source loading boundaries.
 *
 * EvidChecker composes these loaders for normal checks, while integrations
 * can call them directly when they need validated configuration or snapshots.
 */
export { EvidConfigLoader } from "./loaders/EvidConfigLoader";
export { EvidSourceLoader } from "./loaders/EvidSourceLoader";

/**
 * Exports parser sessions, documentation tags, and certified language registry access.
 *
 * Adapter implementations use these boundaries to parse supported artifacts and
 * interpret evidence annotations without importing the command execution layer.
 */
export { EvidDocumentation } from "./parsers/EvidDocumentation";
export { EvidLanguageRegistry } from "./parsers/EvidLanguageRegistry";
export { EvidParser } from "./parsers/EvidParser";
export { EvidParserError } from "./parsers/EvidParserError";
export type { EvidParseSession } from "./parsers/EvidParseSession";
export { EvidTagParser } from "./parsers/EvidTagParser";

/**
 * Exports serializers for check, query, graph, and watch reports.
 *
 * They project already evaluated report objects into text, JSON, or graph formats
 * without changing the underlying inventory, diagnostics, or exit semantics.
 */
export { EvidGraphReporter } from "./reporters/EvidGraphReporter";
export { EvidQueryReporter } from "./reporters/EvidQueryReporter";
export { EvidReporter } from "./reporters/EvidReporter";
export { EvidWatchReporter } from "./reporters/EvidWatchReporter";

/**
 * Exports target parsing and resolution utilities.
 *
 * Query and annotation consumers use them to preserve literal accessor spelling,
 * normalize file addresses, and resolve targets within selected populations.
 */
export { EvidAccessor } from "./targets/EvidAccessor";
export { EvidFileTarget } from "./targets/EvidFileTarget";
export { EvidTargetResolver } from "./targets/EvidTargetResolver";

/**
 * Re-exports public configuration, report, source, and semantic contract types.
 *
 * These type-only exports define the values exchanged by checker, command, loader,
 * and query APIs without adding runtime work to a package import.
 */
export type * from "./structures";
export type * from "./typings";
export { EvidObjcAdapter } from "./adapters/objc/EvidObjcAdapter";
