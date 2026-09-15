import { EvidencePythonAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Reports only annotations attached to eligible Python declarations.
 *
 * The fixture separates comments from declarations by blank lines, indentation,
 * statement kind, and lexical scope so host selection cannot silently move an
 * acknowledgement.
 *
 * 1. Analyze declarations with detached, misindented, private, pass-statement,
 *    local, header, inline, and nested comments.
 * 2. Verify the two adjacent public declarations are the only evidence hosts.
 * 3. Verify unsupported-host diagnostics and retained annotation ranges count
 *    every misplaced tag while discovery remains complete.
 */
export async function test_python_comment_boundaries(): Promise<void> {
  const content = dedent`
    class Detached:
        # @evidence docs/spec.md#blank A blank line breaks attachment.

        title = ""

    class Indented:
            # @evidence docs/spec.md#indent A different indent cannot attach.
        title = ""

    class Private:
        # @evidence docs/spec.md#private A private field cannot host evidence.
        _title = ""

    class Skipped:
        # @evidence docs/spec.md#pass A pass statement cannot host evidence.
        pass
        title = ""

    def body():
        # @evidence docs/spec.md#local A local cannot host evidence.
        title = ""

    class Header: # @evidence docs/spec.md#header A header comment cannot attach.
                 title = ""

    value = 1 # @evidence docs/spec.md#inline An inline comment is not leading documentation.
    # @evidence docs/spec.md#valid Documents only the next declaration.
    valid = 2

    class Outer:
        class Inner:
            pass
        # @evidence docs/spec.md#sibling Documents the dedented sibling.
        sibling = ""
  `;
  const inventory = await new EvidencePythonAdapter().analyze(
    EvidenceTestSourceSnapshot.create("src/boundaries.py", content),
  );

  TestValidator.equals(
    "only adjacent public declarations host evidence",
    inventory.declarations.map((declaration) => declaration.target),
    ["docs/spec.md#valid", "docs/spec.md#sibling"],
  );
  const diagnostics = inventory.diagnostics;
  TestValidator.equals(
    "every misplaced tag produces a finding",
    diagnostics.filter(
      (diagnostic) => diagnostic.code === "unsupported-annotation-host",
    ).length,
    7,
  );
  TestValidator.equals(
    "misplaced comments are retained for fingerprints",
    inventory.annotationRanges.length,
    9,
  );
  TestValidator.equals(
    "declaration discovery remains complete",
    inventory.complete,
    true,
  );
}
