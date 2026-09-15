import { EvidMarkdownAdapter } from "evid";
import type { IEvidDiagnostic } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Reports annotation-looking lines rendered as prose while preserving HTML annotations.
 *
 * Markdown comments are the supported annotation host. Rendered text, lists,
 * quotes, code blocks, `<pre>` content, and MDX template text must not silently
 * become Evid declarations.
 *
 * 1. Analyze a document that places tag syntax in rendered prose and code-like regions.
 * 2. Require one unsupported-host diagnostic for each rendered tag line, at its source line.
 * 3. Verify that prose mentions and code examples add no declarations or diagnostics.
 * 4. Verify that the HTML comment still produces its real Evid target.
 */
export async function test_markdown_prose_tags(): Promise<void> {
  const content = dedent`
    # Guide
    @evid docs/spec.md#plain Rendered prose.
    - @evidExclude docs/spec.md#bullet Rendered list prose.
    > @evidReview docs/spec.md#quote Rendered quote prose.
    1. @link ../source.ts#run Rendered numbered prose.
    This sentence mentions @evid without starting an annotation.
        @evid docs/fake.md#indent This is indented code.
    ~~~markdown
    @evid docs/fake.md#fence This is fenced code.
    ~~~
    <pre>
    @evid docs/fake.md#pre This is rendered code.
    </pre>
    const example={\`
    @evid docs/fake.md#mdx This is rendered code.
    \`}
    <!-- @evid docs/spec.md#real Supplies real evidence. -->
  `;
  const inventory = await new EvidMarkdownAdapter().analyze(
    TestSourceSnapshot.create("guide.md", content),
  );

  TestValidator.equals(
    "reported marker positions",
    inventory.diagnostics.map(line).sort((x, y) => x - y),
    [2, 3, 4, 5],
  );
  TestValidator.equals(
    "every rendered tag line is reported",
    inventory.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
    ],
  );
  TestValidator.equals(
    "HTML annotation remains effective",
    inventory.declarations.map((entry) => entry.target),
    ["docs/spec.md#real"],
  );
}

function line(diagnostic: IEvidDiagnostic): number {
  const location = diagnostic.location;
  if (location === undefined || location.range === undefined)
    throw new Error(`Markdown diagnostic ${diagnostic.code} has no range.`);
  return location.range.start.line;
}
