import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/adapters/markdown/EvidenceMarkdownAdapter";
import type { IEvidenceDiagnostic } from "../../../../packages/evidence/src/structures/IEvidenceDiagnostic";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Reports tag lines rendered as prose and ignores mentions inside prose or code examples. */
export async function test_markdown_prose_tags(): Promise<void> {
  const content = dedent`
    # Guide
    @evidence docs/spec.md#plain Rendered prose.
    - @evidenceExclude docs/spec.md#bullet Rendered list prose.
    > @evidenceReview docs/spec.md#quote Rendered quote prose.
    1. @link ../source.ts#run Rendered numbered prose.
    This sentence mentions @evidence without starting an annotation.
        @evidence docs/fake.md#indent This is indented code.
    ~~~markdown
    @evidence docs/fake.md#fence This is fenced code.
    ~~~
    <pre>
    @evidence docs/fake.md#pre This is rendered code.
    </pre>
    const example={\`
    @evidence docs/fake.md#mdx This is rendered code.
    \`}
    <!-- @evidence docs/spec.md#real Supplies real evidence. -->
  `;
  const inventory = await new EvidenceMarkdownAdapter().analyze(
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

function line(diagnostic: IEvidenceDiagnostic): number {
  const location = diagnostic.location;
  if (location === undefined || location.range === undefined)
    throw new Error(`Markdown diagnostic ${diagnostic.code} has no range.`);
  return location.range.start.line;
}
