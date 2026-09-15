import { EvidenceAccessor } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

/**
 * Parses literal accessor segments without normalizing their public spelling.
 *
 * Dots, spaces, Unicode, escapes, and unsigned numeric names remain distinct
 * target segments.
 *
 * 1. Round-trip identifier, quoted, numeric, Unicode, escaped, and empty literal
 *    segments through formatting and parsing.
 * 2. Verify numeric brackets and literal dots preserve their intended segment
 *    boundaries.
 * 3. Reject empty, malformed, unterminated, noncanonical numeric, quoted, and
 *    invalid-identifier accessor spellings.
 */
export async function test_accessor_segments(): Promise<void> {
  const cases: string[][] = [
    ["SomeClass", "prototype", "member"],
    ["SomeNamespace", "a.b"],
    ["SomeClass", "space name"],
    ["한글", 'a"b\\c'],
    ["Tuple", "0"],
    ["$scope_2", "e\u0301"],
    ["", "😀"],
  ];
  for (const segments of cases)
    TestValidator.equals(
      "accessor round trip",
      EvidenceAccessor.parse(EvidenceAccessor.format(segments)),
      segments,
    );
  TestValidator.equals(
    "numeric bracket stays a literal segment",
    EvidenceAccessor.parse("Tuple[0]"),
    ["Tuple", "0"],
  );
  TestValidator.equals(
    "literal dot stays quoted",
    EvidenceAccessor.format(["A", "B.C"]),
    'A["B.C"]',
  );

  for (const text of [
    "",
    ".A",
    "A.",
    "A..B",
    "A.[0]",
    "A[-1]",
    "A[01]",
    "A['field']",
    'A["unterminated]',
    "A[true]",
    "A[0]B",
    "2startsWithDigit",
    "\u0301startsWithMark",
  ])
    await TestValidator.error("malformed accessor", async () =>
      EvidenceAccessor.parse(text),
    );
}
