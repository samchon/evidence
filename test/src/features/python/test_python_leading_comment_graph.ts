import {
  EvidenceFingerprint,
  EvidenceGraph,
  EvidenceMarkdownAdapter,
  EvidencePythonAdapter,
} from "@wrtnlabs/evidence";
import type { IEvidenceInventory, IEvidenceGraphResult } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Covers a requirement from evidence before a Python class's first member.
 *
 * The graph fixture makes the leading comment the only acknowledgement for a
 * property, then changes its explanatory text to separate metadata from
 * implementation identity.
 *
 * 1. Analyze the Markdown requirement and the class with a leading property
 *    comment.
 * 2. Resolve the declaration into a graph and verify the requirement is covered.
 * 3. Remove the acknowledgement and verify the exact requirement becomes missing,
 *    then compare all subtree fingerprints after metadata and member-body
 *    edits.
 */
export async function test_python_leading_comment_graph(): Promise<void> {
  const reference = await new EvidenceMarkdownAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "docs/spec.md",
      "## Title {#title}\n\nRequires a title.\n",
    ),
  );
  const source = dedent`
    class Sale:
        class Create:
            # @evidence docs/spec.md#title Implements title.
            title = ""
  `;
  const adapter = new EvidencePythonAdapter();
  const baseline = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("src/sale.py", source),
  );
  const edited = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/sale.py",
      source.replace("Implements title.", "Documents the same title contract."),
    ),
  );
  const changed = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/sale.py",
      source.replace('title = ""', 'title = "changed"'),
    ),
  );
  const removed = await adapter.analyze(
    EvidenceTestSourceSnapshot.create(
      "src/sale.py",
      source.replace(/^[ \t]*# @evidence[^\n]*\n/mu, ""),
    ),
  );

  TestValidator.equals(
    "first-member evidence covers the requirement",
    (await evaluate(baseline, reference)).success,
    true,
  );
  const missing = await evaluate(removed, reference);
  TestValidator.equals(
    "removing evidence fails coverage",
    missing.success,
    false,
  );
  TestValidator.equals(
    "the exact requirement becomes missing",
    EvidenceTestGraph.obligation(missing, 0, 0).missingUnitIds,
    reference.units
      .filter((unit) => unit.symbol === "h2")
      .map((unit) => unit.id),
  );

  // The comment may occur in an ancestor's header range as well as its own host.
  for (const unit of baseline.units) {
    TestValidator.equals(
      "annotation edits preserve the subtree fingerprint",
      EvidenceFingerprint.inspect(baseline, unit.id).fingerprint,
      EvidenceFingerprint.inspect(edited, unit.id).fingerprint,
    );
    TestValidator.notEquals(
      "member content changes its ancestors",
      EvidenceFingerprint.inspect(baseline, unit.id).fingerprint,
      EvidenceFingerprint.inspect(changed, unit.id).fingerprint,
    );
  }
}

/**
 * Evaluates property claims against the selected Markdown heading.
 *
 * The graph enables single-host evidence and resolves only property units, so
 * the scenario cannot pass through an unacknowledged Python declaration.
 */
async function evaluate(
  claim: IEvidenceInventory,
  reference: IEvidenceInventory,
): Promise<IEvidenceGraphResult> {
  const selected = reference.units
    .filter((unit) => unit.symbol === "h2")
    .map((unit) => unit.id);
  return EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claim,
        unitIds: claim.units
          .filter((unit) => unit.symbol === "property")
          .map((unit) => unit.id),
        references: [
          {
            severity: "error",
            inventory: reference,
            unitIds: selected,
            singleEvidencePerSymbol: true,
            resolutions: await EvidenceTestGraph.resolveDeclarations(
              claim,
              reference,
              selected,
            ),
          },
        ],
      },
    ],
  });
}
