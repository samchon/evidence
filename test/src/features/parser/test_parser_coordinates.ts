import { EvidenceParser } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

/**
 * Maps parser ranges to original UTF-16 text across Unicode, BOM, and line
 * endings.
 *
 * The fixture has two Unicode identifiers and an astral character before the
 * second identifier on the same line. Byte offsets or code-point columns would
 * misplace that identifier even when ASCII-only extraction appears correct.
 *
 * 1. Parse the original LF text and a second version prefixed by a BOM and using
 *    CRLF.
 * 2. Require two declaration captures in both versions and slice their returned
 *    ranges from the original input, recovering both exact identifier
 *    spellings.
 * 3. Check the second identifier's complete range:
 *
 *    - Start and end offsets follow UTF-16 indexing after the astral character.
 *    - The line remains 2 and columns are relative to the original preceding LF.
 *    - The exclusive end includes exactly the identifier's two code units.
 */
export async function test_parser_coordinates(): Promise<void> {
  const parser = new EvidenceParser();
  const text = dedent`
    // 앞줄 😀
    export const 인사 = "😀"; export const 합계 = 1;
  `;

  try {
    for (const content of [text, "\uFEFF" + text.replaceAll("\n", "\r\n")]) {
      const ranges = await parser.parse(
        { type: "typescript", file: "unicode.ts", content },
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
