import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceParser } from "../../../../packages/evidence/src/EvidenceParser";

/** Keeps Unicode, surrogate pairs, BOM, and CRLF coordinates usable with the original source string. */
export async function test_parser_coordinates(): Promise<void> {
  const parser = new EvidenceParser();
  const text = dedent`
    // 앞줄 😀
    export const 인사 = "😀"; export const 합계 = 1;
  `;

  try {
    for (const content of [text, "\uFEFF" + text.replaceAll("\n", "\r\n")]) {
      const ranges = await parser.parse(
        { type: "typescript", file: "한글.ts", content },
        (session) =>
          session
            .captures("(variable_declarator name: (identifier) @name)")
            .map((capture) => session.range(capture.node)),
      );

      TestValidator.equals("all Unicode declarations", ranges.length, 2);
      TestValidator.equals(
        "round-trip original string slices",
        ranges.map((range) =>
          content.slice(range.start.offset, range.end.offset),
        ),
        ["인사", "합계"],
      );

      // The second identifier follows an astral character on the same line.
      const offset = content.indexOf("합계");
      TestValidator.equals("UTF-16 coordinate after emoji", ranges[1], {
        start: {
          offset,
          line: 2,
          column: offset - content.lastIndexOf("\n", offset),
        },
        end: {
          offset: offset + 2,
          line: 2,
          column: offset + 2 - content.lastIndexOf("\n", offset),
        },
      });
    }
  } finally {
    await parser.close();
  }
}
