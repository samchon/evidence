import { EvidenceDocumentation, EvidenceSourceText } from "@wrtnlabs/evidence";
import type { IEvidenceCommentSyntax, IEvidenceHost } from "@wrtnlabs/evidence";
import type { IEvidenceTestDocumentation } from "./IEvidenceTestDocumentation";

/**
 * Supplies explicit comment classification to the shared parser without
 * scanning arbitrary source.
 */
export namespace EvidenceTestDocumentation {
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
  ): IEvidenceTestDocumentation {
    const content = "// 앞줄 😀\r\n" + comment + "\nexport const example = 0;";
    const start = content.indexOf(comment);
    const range = new EvidenceSourceText(content).range(
      start,
      start + comment.length,
    );
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
      documentation: EvidenceDocumentation.read(content, host.id, range, syntax),
    };
  }
}
