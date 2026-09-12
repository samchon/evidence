import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceDocumentation } from "../../../../packages/evidence/src/EvidenceDocumentation";
import { EvidenceParser } from "../../../../packages/evidence/src/EvidenceParser";
import { EvidenceTagParser } from "../../../../packages/evidence/src/EvidenceTagParser";
import type { IEvidenceHost } from "../../../../packages/evidence/src/structures/IEvidenceHost";

/** Parser-owned comment spans prevent tag-shaped strings and regexes from entering documentation parsing. */
export async function test_tag_parser_tree_comments(): Promise<void> {
  const content = dedent`
    const example = "/** @evidence ../fake.ts#name Not a comment. */";
    const expression = /@evidence/;
    /** @evidence ../real.ts#run Verifies the function. */
    export function test_run() {}
  `;
  const parser = new EvidenceParser();
  try {
    const targets = await parser.parse(
      { type: "typescript", file: "/project/test.ts", content },
      (session) => {
        return session
          .captures("(comment) @documentation")
          .flatMap((capture) => {
            const range = session.range(capture.node);
            const host: IEvidenceHost = {
              id: "test-doc",
              file: "/project/test.ts",
              range,
              siteId: "test-site",
              unitIds: ["test-run"],
              attachment: "attached",
            };
            const documentation = EvidenceDocumentation.read(
              content,
              host.id,
              range,
              {
                opening: "/**",
                closing: "*/",
                linePrefix: "*",
                tagBoundaries: true,
                allowWithdrawal: true,
              },
            );
            return EvidenceTagParser.parse(
              content,
              host,
              documentation,
            ).declarations.map((entry) => entry.target);
          });
      },
    );
    TestValidator.equals(
      "only the real documentation comment contributes",
      targets,
      ["../real.ts#run"],
    );
  } finally {
    await parser.close();
  }
}
