import { EvidenceMarkdownAdapter } from "evidence";
import type { IEvidenceDeclaration, IEvidenceHost, IEvidenceUnit } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Excludes Markdown syntax examples from heading and annotation discovery.
 *
 * Fence, inline-code, rendered-code, MDX-template, indentation, and comment
 * regions may contain realistic Evid syntax without declaring a public unit or
 * host.
 *
 * 1. Analyze one visible heading plus heading and annotation syntax in each
 *    excluded region.
 * 2. Mention rendered tags in several literal forms and require them not to hide a
 *    later real heading.
 * 3. Put close/open transitions on the same line and require their last boundary
 *    to govern whether following headings remain rendered.
 * 4. Put an unmatched closing tag inside an explicitly anchored heading and
 *    require the heading to remain a normal structural unit.
 * 5. Close active rendered regions through backticked and escaped close tags;
 *    require both following headings to resume normal structural parsing.
 * 6. Leave inline-code and escaped HTML comment openers unmatched; require both
 *    following headings to remain visible and neither literal to own a host.
 * 7. Mention `<pre>` after prose and inside an anchored heading; require neither
 *    inline occurrence to begin a raw HTML block or hide later structure.
 * 8. Open raw blocks with spaced or compact slash syntax and incomplete line-start
 *    `pre` tags, ignore a malformed close, and resume structure only after each
 *    exact CommonMark close.
 * 9. Compose comment and rendered transitions when one region closes before the
 *    other opens later on the same line, including a four-transition chain.
 * 10. Keep HTML and MDX rendered regions open across the other grammar's close.
 * 11. Ignore comment and `pre` delimiter text inside quoted HTML attributes.
 * 12. Remove real inline comments from generated and explicit heading names while
 *     retaining authored whitespace and a tag-bearing comment on the host.
 * 13. Keep a comment adjacent to an ATX marker from fabricating a heading.
 * 14. Verify only the visible headings and real children materialize as section
 *     units.
 * 15. Verify only real HTML comments declare their Evid targets.
 * 16. Require no diagnostics from the ignored examples.
 */
export async function test_markdown_boundaries(): Promise<void> {
  const content = dedent`
    # Visible

    ~~~~markdown
    ## Fenced heading
    <!-- @evidence docs/fake.md#fenced This is an example. -->
    ~~~~

    \`<!-- @evidence docs/fake.md#inline This is inline code. -->\`

    <pre>
    ## Rendered heading
    @evidence docs/fake.md#pre This is rendered code.
    </pre>

    const example={\`
    ## MDX heading
    @evidence docs/fake.md#mdx This is rendered code.
    \`}

    Literal \`<pre>\`, \`</pre>\`, paired \`<pre></pre>\`, longer \`\`<pre>\`\`, escaped \\<pre>, and <prefix> prose.

    ## After literals

    ## Heading with unmatched close </pre> {#unmatched-close}

    <pre>
    </pre><pre>
    ## Rendered after close then open
    </pre>

    ## After close then open

    <pre></pre><pre>
    ## Rendered after open close open
    </pre>

    ## After open close open

    <pre>
    \`</pre>\`
    ## After backticked rendered close

    <pre>
    \\</pre>
    ## After escaped rendered close

    \`<!--\`
    ## After inline comment literal

    \\<!--
    ## After escaped comment literal

    Ordinary prose contains <pre> without opening a raw HTML block.
    ## Heading with inline pre <pre> {#inline-pre}

    ## After inline pre prose

    <pre />
    ## Rendered after slash-closed opening
    </pre>

    ## After slash-closed opening

    <pre/>
    ## Rendered after compact slash opening
    </pre>

    ## After compact slash opening

    <pre
    ## Rendered after incomplete opening
    </pre class="invalid">
    ## Rendered after malformed close
    </pre>

    ## After exact rendered close

        <pre> This indented example does not open a rendered block.

    <!--
      ## Comment heading
      @evidence docs/spec.md#rule Implements the visible <pre> section.
    -->

    <!--
    Comment before rendered code.
    --> <pre>
    ## Rendered after comment close and pre open
    @evidence docs/fake.md#comment-pre This remains rendered.
    </pre>

    ## After comment close and pre open

    <pre>
    </pre><!--
    ## Commented after pre close and comment open
    This comment mentions @evidence without declaring it.
    -->

    ## After pre close and comment open

    <!-- first --> <pre></pre><!-- second
    ## Commented after composed transition chain
    -->

    ## After composed transition chain

    <pre>
    \`}
    ## Rendered after foreign template close
    </pre>

    ## After pre ignores template close

    const mixed={\`
    </pre>
    ## Rendered after foreign pre close
    \`}

    ## After template ignores pre close

    <div title="<!-- @evidence docs/fake.md#attribute Fabricated. -->"><span title="<pre>">Visible attributes.</span></div>

    ## Generated <!-- hidden heading text --> name

    ## Explicit <!-- hidden heading text --> name {#explicit-comment}

    ## Tagged <!-- @evidence docs/spec.md#heading Implements the heading. --> name {#tagged-comment}

    ## Deliberately  <!-- invisible --> spaced {#spaced-comment}

    #<!-- invisible --> Not a heading

    ## Real child
  `;
  const inventory = await new EvidenceMarkdownAdapter().analyze(
    EvidenceTestSourceSnapshot.create("guide.md", content),
  );

  TestValidator.equals(
    "only real headings materialize",
    inventory.units.map((unit: IEvidenceUnit): string => unit.name).sort(compare),
    [
      "After backticked rendered close",
      "After close then open",
      "After comment close and pre open",
      "After compact slash opening",
      "After composed transition chain",
      "After escaped comment literal",
      "After escaped rendered close",
      "After exact rendered close",
      "After inline comment literal",
      "After inline pre prose",
      "After literals",
      "After open close open",
      "After pre close and comment open",
      "After pre ignores template close",
      "After slash-closed opening",
      "After template ignores pre close",
      "Deliberately  spaced",
      "Explicit name",
      "Generated name",
      "Heading with inline pre <pre>",
      "Heading with unmatched close </pre>",
      "Real child",
      "Tagged name",
      "Visible",
      "guide.md",
    ],
  );
  TestValidator.equals(
    "only real HTML annotations are parsed",
    inventory.declarations
      .map((entry: IEvidenceDeclaration): string => entry.target)
      .sort(compare),
    ["docs/spec.md#heading", "docs/spec.md#rule"],
  );
  const tagged: IEvidenceUnit | undefined = inventory.units.find(
    (unit: IEvidenceUnit): boolean => unit.identity.at(-1) === "tagged-comment",
  );
  const declaration: IEvidenceDeclaration | undefined = inventory.declarations.find(
    (entry: IEvidenceDeclaration): boolean =>
      entry.target === "docs/spec.md#heading",
  );
  const host: IEvidenceHost | undefined = inventory.hosts.find(
    (entry: IEvidenceHost): boolean => entry.id === declaration?.hostId,
  );
  TestValidator.equals(
    "heading-line annotation attaches to that heading",
    host?.unitIds,
    tagged === undefined ? [] : [tagged.id],
  );
  TestValidator.equals(
    "example annotations stay silent",
    inventory.diagnostics,
    [],
  );
}

/**
 * Orders fixture labels without relying on locale-specific collation.
 *
 * The expected unit list uses the same lexical comparison so the assertion
 * tests membership independently of adapter collection order.
 */
function compare(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}
