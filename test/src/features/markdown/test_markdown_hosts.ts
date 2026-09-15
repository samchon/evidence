import { EvidenceMarkdownAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Attaches Markdown HTML comments to supported heading hosts.
 *
 * Comment ownership follows the current file or H1-H4 section. Comments below
 * H5/H6 are retained as hosts for diagnostics but cannot contribute
 * declarations.
 *
 * 1. Analyze CRLF content with file, parent, child, deep-heading, and
 *    supported-heading comments.
 * 2. Verify host attachment counts and the collected evidence, exclusion, and
 *    review records.
 * 3. Require an unsupported-host diagnostic only for the comment under the H5
 *    heading.
 * 4. Verify the review range uses original CRLF coordinates and slices to its
 *    annotation text.
 */
export async function test_markdown_hosts(): Promise<void> {
  const content = dedent`
    <!-- @evidence docs/spec.md#file Supplies the document contract. -->
    # Parent
    <!-- @evidenceReview docs/spec.md#file #abcdef0 Checked the document. -->
    ## Child
    <!-- An eligible host without an Evid tag. -->
    ##### Unsupported detail
    <!-- @evidence docs/spec.md#detail This host is too deep. -->
    #### Supported again
    <!-- @evidenceExclude docs/spec.md#optional This part does not apply. -->
  `.replaceAll("\n", "\r\n");
  const inventory = await new EvidenceMarkdownAdapter().analyze(
    EvidenceTestSourceSnapshot.create("guide.md", content),
  );

  TestValidator.equals(
    "every real HTML comment is registered",
    inventory.hosts.length,
    5,
  );
  TestValidator.equals(
    "attached host count",
    inventory.hosts.filter((host) => host.attachment === "attached").length,
    4,
  );
  TestValidator.equals(
    "unsupported host count",
    inventory.hosts.filter((host) => host.attachment === "unsupported").length,
    1,
  );
  TestValidator.equals(
    "positive acknowledgement count",
    inventory.declarations.filter((entry) => entry.kind === "evidence").length,
    1,
  );
  TestValidator.equals(
    "exclusion acknowledgement count",
    inventory.declarations.filter((entry) => entry.kind === "evidenceExclude")
      .length,
    1,
  );
  TestValidator.equals("review collection", inventory.reviews.length, 1);
  TestValidator.equals(
    "deep heading diagnostic",
    inventory.diagnostics.map((diagnostic) => diagnostic.code),
    ["unsupported-annotation-host"],
  );

  const review = inventory.reviews[0];
  if (review === undefined || review.location.range === undefined)
    throw new Error("The Markdown review has no source range.");
  TestValidator.equals(
    "original CRLF line",
    review.location.range.start.line,
    3,
  );
  TestValidator.equals(
    "original review text",
    content.slice(
      review.location.range.start.offset,
      review.location.range.end.offset,
    ),
    "@evidenceReview docs/spec.md#file #abcdef0 Checked the document.",
  );
}
