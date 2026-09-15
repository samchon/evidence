import { EvidDocumentation } from "evid";
import type { IEvidCommentSyntax, IEvidHost } from "evid";
import { EvidSourceText } from "../../../packages/evidence/src/internal/EvidSourceText";
import type { ITestDocumentation } from "./ITestDocumentation";

/** Supplies explicit comment classification to the shared parser without scanning arbitrary source. */
export namespace TestDocumentation {
  export function create(
    comment: string,
    syntax: IEvidCommentSyntax = {
      opening: "/**",
      closing: "*/",
      linePrefix: "*",
      tagBoundaries: true,
      allowWithdrawal: true,
    },
    attachment: IEvidHost["attachment"] = "attached",
  ): ITestDocumentation {
    const content = "// 앞줄 😀\r\n" + comment + "\nexport const example = 0;";
    const start = content.indexOf(comment);
    const range = new EvidSourceText(content).range(start, start + comment.length);
    const host: IEvidHost = {
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
      documentation: EvidDocumentation.read(
        content,
        host.id,
        range,
        syntax,
      ),
    };
  }
}
