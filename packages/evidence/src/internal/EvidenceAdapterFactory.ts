import { EvidenceBigQueryAdapter } from "../adapters/bigquery/EvidenceBigQueryAdapter";
import { EvidenceCAdapter } from "../adapters/c/EvidenceCAdapter";
import { EvidenceCppAdapter } from "../adapters/cpp/EvidenceCppAdapter";
import { EvidenceCSharpAdapter } from "../adapters/csharp/EvidenceCSharpAdapter";
import { EvidenceGoAdapter } from "../adapters/go/EvidenceGoAdapter";
import { EvidenceJavaAdapter } from "../adapters/java/EvidenceJavaAdapter";
import { EvidenceJavaScriptAdapter } from "../adapters/javascript/EvidenceJavaScriptAdapter";
import { EvidenceKotlinAdapter } from "../adapters/kotlin/EvidenceKotlinAdapter";
import { EvidenceMarkdownAdapter } from "../adapters/markdown/EvidenceMarkdownAdapter";
import { EvidenceMatlabAdapter } from "../adapters/matlab/EvidenceMatlabAdapter";
import { EvidencePrismaAdapter } from "../adapters/prisma/EvidencePrismaAdapter";
import { EvidencePythonAdapter } from "../adapters/python/EvidencePythonAdapter";
import { EvidenceRubyAdapter } from "../adapters/ruby/EvidenceRubyAdapter";
import { EvidenceScalaAdapter } from "../adapters/scala/EvidenceScalaAdapter";
import { EvidenceRustAdapter } from "../adapters/rust/EvidenceRustAdapter";
import { EvidenceSqlAdapter } from "../adapters/sql/EvidenceSqlAdapter";
import { EvidenceSwiftAdapter } from "../adapters/swift/EvidenceSwiftAdapter";
import { EvidenceSwaggerAdapter } from "../adapters/swagger/EvidenceSwaggerAdapter";
import { EvidenceTypeScriptAdapter } from "../adapters/typescript/EvidenceTypeScriptAdapter";
import type { IEvidenceAdapter } from "../structures/IEvidenceAdapter";
import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";

/** Creates only adapters whose complete Evidence behavior is certified. */
export namespace EvidenceAdapterFactory {
  export function create(type: EvidenceArtifactType): IEvidenceAdapter {
    if (type === "bigquery") return new EvidenceBigQueryAdapter();
    if (type === "c") return new EvidenceCAdapter();
    if (type === "cpp") return new EvidenceCppAdapter();
    if (type === "csharp") return new EvidenceCSharpAdapter();
    if (type === "go") return new EvidenceGoAdapter();
    if (type === "java") return new EvidenceJavaAdapter();
    if (type === "javascript") return new EvidenceJavaScriptAdapter();
    if (type === "kotlin") return new EvidenceKotlinAdapter();
    if (type === "markdown") return new EvidenceMarkdownAdapter();
    if (type === "matlab") return new EvidenceMatlabAdapter();
    if (type === "prisma") return new EvidencePrismaAdapter();
    if (type === "python") return new EvidencePythonAdapter();
    if (type === "ruby") return new EvidenceRubyAdapter();
    if (type === "scala") return new EvidenceScalaAdapter();
    if (type === "rust") return new EvidenceRustAdapter();
    if (type === "sql") return new EvidenceSqlAdapter();
    if (type === "swift") return new EvidenceSwiftAdapter();
    if (type === "swagger") return new EvidenceSwaggerAdapter();
    if (type === "typescript") return new EvidenceTypeScriptAdapter();
    throw new Error(
      `Artifact type '${type}' has no certified Evidence adapter.`,
    );
  }
}
