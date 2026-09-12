import { EvidenceCAdapter } from "../EvidenceCAdapter";
import { EvidenceCppAdapter } from "../EvidenceCppAdapter";
import { EvidenceCSharpAdapter } from "../EvidenceCSharpAdapter";
import { EvidenceGoAdapter } from "../EvidenceGoAdapter";
import { EvidenceJavaAdapter } from "../EvidenceJavaAdapter";
import { EvidenceJavaScriptAdapter } from "../EvidenceJavaScriptAdapter";
import { EvidenceMarkdownAdapter } from "../EvidenceMarkdownAdapter";
import { EvidencePrismaAdapter } from "../EvidencePrismaAdapter";
import { EvidencePythonAdapter } from "../EvidencePythonAdapter";
import { EvidenceRubyAdapter } from "../EvidenceRubyAdapter";
import { EvidenceRustAdapter } from "../EvidenceRustAdapter";
import { EvidenceSwaggerAdapter } from "../EvidenceSwaggerAdapter";
import { EvidenceTypeScriptAdapter } from "../EvidenceTypeScriptAdapter";
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
