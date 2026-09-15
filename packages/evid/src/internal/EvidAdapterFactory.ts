import { EvidObjcAdapter } from "../adapters/objc/EvidObjcAdapter";
import { EvidDartAdapter } from "../adapters/dart/EvidDartAdapter";
import { EvidCAdapter } from "../adapters/c/EvidCAdapter";
import { EvidBigQueryAdapter } from "../adapters/bigquery/EvidBigQueryAdapter";
import { EvidCppAdapter } from "../adapters/cpp/EvidCppAdapter";
import { EvidCSharpAdapter } from "../adapters/csharp/EvidCSharpAdapter";
import { EvidDbmlAdapter } from "../adapters/dbml/EvidDbmlAdapter";
import { EvidGoAdapter } from "../adapters/go/EvidGoAdapter";
import { EvidJavaAdapter } from "../adapters/java/EvidJavaAdapter";
import { EvidJavaScriptAdapter } from "../adapters/javascript/EvidJavaScriptAdapter";
import { EvidKotlinAdapter } from "../adapters/kotlin/EvidKotlinAdapter";
import { EvidLuaAdapter } from "../adapters/lua/EvidLuaAdapter";
import { EvidMarkdownAdapter } from "../adapters/markdown/EvidMarkdownAdapter";
import { EvidMatlabAdapter } from "../adapters/matlab/EvidMatlabAdapter";
import { EvidPhpAdapter } from "../adapters/php/EvidPhpAdapter";
import { EvidMysqlAdapter } from "../adapters/mysql/EvidMysqlAdapter";
import { EvidPrismaAdapter } from "../adapters/prisma/EvidPrismaAdapter";
import { EvidPostgresqlAdapter } from "../adapters/postgresql/EvidPostgresqlAdapter";
import { EvidPythonAdapter } from "../adapters/python/EvidPythonAdapter";
import { EvidRubyAdapter } from "../adapters/ruby/EvidRubyAdapter";
import { EvidScalaAdapter } from "../adapters/scala/EvidScalaAdapter";
import { EvidRustAdapter } from "../adapters/rust/EvidRustAdapter";
import { EvidSqlAdapter } from "../adapters/sql/EvidSqlAdapter";
import { EvidSqliteAdapter } from "../adapters/sqlite/EvidSqliteAdapter";
import { EvidSwiftAdapter } from "../adapters/swift/EvidSwiftAdapter";
import { EvidSwaggerAdapter } from "../adapters/swagger/EvidSwaggerAdapter";
import { EvidTypeScriptAdapter } from "../adapters/typescript/EvidTypeScriptAdapter";
import { EvidZigAdapter } from "../adapters/zig/EvidZigAdapter";
import type { IEvidAdapter } from "../structures/IEvidAdapter";
import type { EvidArtifactType } from "../typings/EvidArtifactType";

/**
 * Constructs the adapter implementing one certified artifact contract.
 *
 * A fresh instance isolates parser/session state between analyses; unsupported
 * additions fail here instead of producing a partial inventory downstream.
 */
export namespace EvidAdapterFactory {
  /** Creates the dedicated adapter for a validated artifact discriminator.
   *
   * Each call returns a fresh instance so parser and scan state cannot cross an inventory boundary.
   */
  export function create(type: EvidArtifactType): IEvidAdapter {
    if (type === "objc") return new EvidObjcAdapter();
    if (type === "dart") return new EvidDartAdapter();
    if (type === "c") return new EvidCAdapter();
    if (type === "bigquery") return new EvidBigQueryAdapter();
    if (type === "cpp") return new EvidCppAdapter();
    if (type === "csharp") return new EvidCSharpAdapter();
    if (type === "dbml") return new EvidDbmlAdapter();
    if (type === "go") return new EvidGoAdapter();
    if (type === "java") return new EvidJavaAdapter();
    if (type === "javascript") return new EvidJavaScriptAdapter();
    if (type === "kotlin") return new EvidKotlinAdapter();
    if (type === "lua") return new EvidLuaAdapter();
    if (type === "markdown") return new EvidMarkdownAdapter();
    if (type === "matlab") return new EvidMatlabAdapter();
    if (type === "php") return new EvidPhpAdapter();
    if (type === "mysql") return new EvidMysqlAdapter();
    if (type === "prisma") return new EvidPrismaAdapter();
    if (type === "postgresql") return new EvidPostgresqlAdapter();
    if (type === "python") return new EvidPythonAdapter();
    if (type === "ruby") return new EvidRubyAdapter();
    if (type === "scala") return new EvidScalaAdapter();
    if (type === "rust") return new EvidRustAdapter();
    if (type === "sql") return new EvidSqlAdapter();
    if (type === "sqlite") return new EvidSqliteAdapter();
    if (type === "swift") return new EvidSwiftAdapter();
    if (type === "swagger") return new EvidSwaggerAdapter();
    if (type === "typescript") return new EvidTypeScriptAdapter();
    if (type === "zig") return new EvidZigAdapter();
    throw new Error(
      `Artifact type '${type}' has no certified Evid adapter.`,
    );
  }
}
