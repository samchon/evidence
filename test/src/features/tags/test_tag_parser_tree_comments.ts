import { EvidDocumentation, EvidParser, EvidTagParser } from "evid";
import type { IEvidHost } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

/**
 * Uses parser-owned comment spans to exclude tag-shaped code text.
 *
 * Strings and regular expressions can resemble annotations but only real
 * comment spans may enter documentation parsing.
 *
 * 1. Parse source containing a tag-shaped string, regular expression, and real
 *    documentation comment through the TypeScript syntax tree.
 * 2. Map only parser-captured comment spans into documentation and parse tags.
 * 3. Require the real comment's one target while excluding both code-text
 *    lookalikes.
 */
export async function test_tag_parser_tree_comments(): Promise<void> {
  const content = dedent`
    const example = "/** @evidence ../fake.ts#name Not a comment. */";
    const expression = /@evidence/;
    /** @evidence ../real.ts#run Verifies the function. */
    export function test_run() {}
  `;
  const parser = new EvidParser();
  try {
    const targets = await parser.parse(
      { type: "typescript", file: "/project/test.ts", content },
      (session) => {
        return session
          .captures("(comment) @documentation")
          .flatMap((capture) => {
            const range = session.range(capture.node);
            const host: IEvidHost = {
              id: "test-doc",
              file: "/project/test.ts",
              range,
              siteId: "test-site",
              unitIds: ["test-run"],
              attachment: "attached",
            };
            const documentation = EvidDocumentation.read(
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
            return EvidTagParser.parse(
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
