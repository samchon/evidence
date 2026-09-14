import { EvidenceDocumentation } from "@wrtnlabs/evidence";
import type { IEvidenceCommentSyntax, IEvidenceHost } from "@wrtnlabs/evidence";
import { SourceText } from "../../../packages/evidence/src/internal/SourceText";
import type { ITestDocumentation } from "./ITestDocumentation";

/** Supplies explicit comment classification to the shared parser without scanning arbitrary source. */
export namespace TestDocumentation {
  export function create(
    comment: string,
    syntax: IEvidenceCommentSyntax = {
      opening: "/**",
      closing: "*/",
      linePrefix: "*",
      tagBoundaries: true,
      allowWithdrawal: true,
    },
    attachment: IEvidenceHost["attachment"] = "attached",
  ): ITestDocumentation {
    const content = "// 앞줄 😀\r\n" + comment + "\nexport const example = 0;";
    const start = content.indexOf(comment);
    const range = new SourceText(content).range(start, start + comment.length);
    const host: IEvidenceHost = {
      id: "host",
      file: "/project/example.ts",
      range,
      attachment,
      unitIds: attachment === "attached" ? ["example"] : [],
      ...(attachment === "attached" ? { siteId: "example-site" } : {}),
    };
    return {
      content,
      host,
      documentation: EvidenceDocumentation.read(
        content,
        host.id,
        range,
        syntax,
      ),
    };
  }
}
