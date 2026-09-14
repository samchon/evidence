import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTagParser } from "../../../../packages/evidence/src/parsers/EvidenceTagParser";
import { TestDocumentation } from "../../internal/TestDocumentation";

/** Preserves HTML prose boundaries and Prisma-style tag boundaries with exact CRLF source locations. */
export async function test_tag_comment_styles(): Promise<void> {
  const html = TestDocumentation.create(
    dedent`
    <!--
      @evidence docs/spec.md#rule Implements the rule.
      @architecture approved this wording.
      @internal is prose in this host grammar.
      @evidenceReview docs/spec.md#rule Reviewed the claim.
    -->
  `,
    {
      opening: "<!--",
      closing: "-->",
      tagBoundaries: false,
      allowWithdrawal: false,
    },
  );
  const htmlResult = EvidenceTagParser.parse(
    html.content,
    html.host,
    html.documentation,
  );
  TestValidator.equals(
    "HTML has no foreign-tag field syntax",
    htmlResult.declarations.map((entry) => entry.reason),
    [
      "Implements the rule.\n@architecture approved this wording.\n@internal is prose in this host grammar.",
    ],
  );
  TestValidator.equals(
    "HTML prose cannot withdraw a declaration",
    htmlResult.withdrawals,
    [],
  );
  TestValidator.equals(
    "review still ends HTML acknowledgement",
    htmlResult.reviews.length,
    1,
  );

  const prisma = TestDocumentation.create(
    dedent`
    /// @evidence prisma:Sale.price Implements the column.
    /// @namespace Shop
    /// @internal Implementation detail.
  `.replaceAll("\n", "\r\n"),
    {
      opening: "",
      closing: "",
      linePrefix: "///",
      tagBoundaries: true,
      allowWithdrawal: true,
    },
  );
  const prismaResult = EvidenceTagParser.parse(
    prisma.content,
    prisma.host,
    prisma.documentation,
  );
  TestValidator.equals(
    "Prisma foreign tag closes reason",
    prismaResult.declarations.map((entry) => entry.reason),
    ["Implements the column."],
  );
  TestValidator.equals(
    "line-start withdrawal",
    prismaResult.withdrawals.map((withdrawal) => withdrawal.tag),
    ["internal"],
  );

  const entry = prismaResult.declarations[0];
  if (entry === undefined || entry.location.range === undefined)
    throw new Error("Missing annotation range.");
  const range = entry.location.range;
  const expected = "@evidence prisma:Sale.price Implements the column.";
  TestValidator.equals(
    "exact source span excludes CR and comment prefix",
    prisma.content.slice(range.start.offset, range.end.offset),
    expected,
  );
  TestValidator.equals("original one-based source line", range.start.line, 2);
  TestValidator.equals("original column after prefix", range.start.column, 5);
}
