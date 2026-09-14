import { EvidenceCAdapter } from "../adapters/c/EvidenceCAdapter";
import { EvidenceCppAdapter } from "../adapters/cpp/EvidenceCppAdapter";
import { EvidenceCSharpAdapter } from "../adapters/csharp/EvidenceCSharpAdapter";
import { EvidenceGoAdapter } from "../adapters/go/EvidenceGoAdapter";
import { EvidenceJavaAdapter } from "../adapters/java/EvidenceJavaAdapter";
import { EvidenceJavaScriptAdapter } from "../adapters/javascript/EvidenceJavaScriptAdapter";
import { EvidenceMarkdownAdapter } from "../adapters/markdown/EvidenceMarkdownAdapter";
import { EvidencePrismaAdapter } from "../adapters/prisma/EvidencePrismaAdapter";
import { EvidencePythonAdapter } from "../adapters/python/EvidencePythonAdapter";
import { EvidenceRubyAdapter } from "../adapters/ruby/EvidenceRubyAdapter";
import { EvidenceRustAdapter } from "../adapters/rust/EvidenceRustAdapter";
import { EvidenceSwaggerAdapter } from "../adapters/swagger/EvidenceSwaggerAdapter";
import { EvidenceTypeScriptAdapter } from "../adapters/typescript/EvidenceTypeScriptAdapter";
import type { IEvidenceAdapter } from "../structures/IEvidenceAdapter";
import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";

/** Creates only adapters whose complete Evidence behavior is certified. */
export namespace EvidenceAdapterFactory {
  export function create(type: EvidenceArtifactType): IEvidenceAdapter {
    if (type === "c") return new EvidenceCAdapter();
    if (type === "cpp") return new EvidenceCppAdapter();
    if (type === "csharp") return new EvidenceCSharpAdapter();
    if (type === "go") return new EvidenceGoAdapter();
    if (type === "java") return new EvidenceJavaAdapter();
    if (type === "javascript") return new EvidenceJavaScriptAdapter();
    if (type === "markdown") return new EvidenceMarkdownAdapter();
    if (type === "prisma") return new EvidencePrismaAdapter();
    if (type === "python") return new EvidencePythonAdapter();
    if (type === "ruby") return new EvidenceRubyAdapter();
    if (type === "rust") return new EvidenceRustAdapter();
    if (type === "swagger") return new EvidenceSwaggerAdapter();
    if (type === "typescript") return new EvidenceTypeScriptAdapter();
    throw new Error(
      `Artifact type '${type}' has no certified Evidence adapter.`,
    );
  }
}
