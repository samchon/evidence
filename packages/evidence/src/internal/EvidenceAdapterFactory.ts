import { EvidenceObjcAdapter } from "../adapters/objc/EvidenceObjcAdapter";
import { EvidenceDartAdapter } from "../adapters/dart/EvidenceDartAdapter";
import { EvidenceCAdapter } from "../adapters/c/EvidenceCAdapter";
import { EvidenceBigQueryAdapter } from "../adapters/bigquery/EvidenceBigQueryAdapter";
import { EvidenceCppAdapter } from "../adapters/cpp/EvidenceCppAdapter";
import { EvidenceCSharpAdapter } from "../adapters/csharp/EvidenceCSharpAdapter";
import { EvidenceDbmlAdapter } from "../adapters/dbml/EvidenceDbmlAdapter";
import { EvidenceGoAdapter } from "../adapters/go/EvidenceGoAdapter";
import { EvidenceJavaAdapter } from "../adapters/java/EvidenceJavaAdapter";
import { EvidenceJavaScriptAdapter } from "../adapters/javascript/EvidenceJavaScriptAdapter";
import { EvidenceKotlinAdapter } from "../adapters/kotlin/EvidenceKotlinAdapter";
import { EvidenceLuaAdapter } from "../adapters/lua/EvidenceLuaAdapter";
import { EvidenceMarkdownAdapter } from "../adapters/markdown/EvidenceMarkdownAdapter";
import { EvidenceMatlabAdapter } from "../adapters/matlab/EvidenceMatlabAdapter";
import { EvidencePhpAdapter } from "../adapters/php/EvidencePhpAdapter";
import { EvidenceMysqlAdapter } from "../adapters/mysql/EvidenceMysqlAdapter";
import { EvidencePrismaAdapter } from "../adapters/prisma/EvidencePrismaAdapter";
import { EvidencePostgresqlAdapter } from "../adapters/postgresql/EvidencePostgresqlAdapter";
import { EvidencePythonAdapter } from "../adapters/python/EvidencePythonAdapter";
import { EvidenceRubyAdapter } from "../adapters/ruby/EvidenceRubyAdapter";
import { EvidenceScalaAdapter } from "../adapters/scala/EvidenceScalaAdapter";
import { EvidenceRustAdapter } from "../adapters/rust/EvidenceRustAdapter";
import { EvidenceSqlAdapter } from "../adapters/sql/EvidenceSqlAdapter";
import { EvidenceSqliteAdapter } from "../adapters/sqlite/EvidenceSqliteAdapter";
import { EvidenceSwiftAdapter } from "../adapters/swift/EvidenceSwiftAdapter";
import { EvidenceSwaggerAdapter } from "../adapters/swagger/EvidenceSwaggerAdapter";
import { EvidenceTypeScriptAdapter } from "../adapters/typescript/EvidenceTypeScriptAdapter";
import { EvidenceZigAdapter } from "../adapters/zig/EvidenceZigAdapter";
import type { IEvidenceAdapter } from "../structures/IEvidenceAdapter";
import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";

/**
 * Constructs the adapter implementing one certified artifact contract.
 *
 * A fresh instance isolates parser/session state between analyses; unsupported
 * additions fail here instead of producing a partial inventory downstream.
 */
export namespace EvidenceAdapterFactory {
  /**
   * Creates the dedicated adapter for a validated artifact discriminator.
   *
   * Each call returns a fresh instance so parser and scan state cannot cross an
   * inventory boundary.
   */
  export function create<Type extends EvidenceArtifactType>(
    type: Type,
  ): IEvidenceAdapter<Type>;
  export function create(type: EvidenceArtifactType): IEvidenceAdapter {
    if (type === "objc") return new EvidenceObjcAdapter();
    if (type === "dart") return new EvidenceDartAdapter();
    if (type === "c") return new EvidenceCAdapter();
    if (type === "bigquery") return new EvidenceBigQueryAdapter();
    if (type === "cpp") return new EvidenceCppAdapter();
    if (type === "csharp") return new EvidenceCSharpAdapter();
    if (type === "dbml") return new EvidenceDbmlAdapter();
    if (type === "go") return new EvidenceGoAdapter();
    if (type === "java") return new EvidenceJavaAdapter();
    if (type === "javascript") return new EvidenceJavaScriptAdapter();
    if (type === "kotlin") return new EvidenceKotlinAdapter();
    if (type === "lua") return new EvidenceLuaAdapter();
    if (type === "markdown") return new EvidenceMarkdownAdapter();
    if (type === "matlab") return new EvidenceMatlabAdapter();
    if (type === "php") return new EvidencePhpAdapter();
    if (type === "mysql") return new EvidenceMysqlAdapter();
    if (type === "prisma") return new EvidencePrismaAdapter();
    if (type === "postgresql") return new EvidencePostgresqlAdapter();
    if (type === "python") return new EvidencePythonAdapter();
    if (type === "ruby") return new EvidenceRubyAdapter();
    if (type === "scala") return new EvidenceScalaAdapter();
    if (type === "rust") return new EvidenceRustAdapter();
    if (type === "sql") return new EvidenceSqlAdapter();
    if (type === "sqlite") return new EvidenceSqliteAdapter();
    if (type === "swift") return new EvidenceSwiftAdapter();
    if (type === "swagger") return new EvidenceSwaggerAdapter();
    if (type === "typescript") return new EvidenceTypeScriptAdapter();
    if (type === "zig") return new EvidenceZigAdapter();
    throw new Error(`Artifact type '${type}' has no certified evidence adapter.`);
  }
}
