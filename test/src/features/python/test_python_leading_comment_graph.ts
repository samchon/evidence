import {
  EvidFingerprint,
  EvidGraph,
  EvidMarkdownAdapter,
  EvidPythonAdapter,
} from "evid";
import type {
  IEvidInventory,
  IEvidGraphResult,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Covers a requirement from evidence before a Python class's first member.
 *
 * The graph fixture makes the leading comment the only acknowledgement for a property, then changes its explanatory text to separate metadata from implementation identity.
 *
 * 1. Analyze the Markdown requirement and the class with a leading property comment.
 * 2. Resolve the declaration into a graph and verify the requirement is covered.
 * 3. Remove the acknowledgement and verify the exact requirement becomes missing, then compare all subtree fingerprints after metadata and member-body edits.
 */
export async function test_python_leading_comment_graph(): Promise<void> {
  const reference = await new EvidMarkdownAdapter().analyze(
    EvidTestSourceSnapshot.create(
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
  const adapter = new EvidPythonAdapter();
  const baseline = await adapter.analyze(
    EvidTestSourceSnapshot.create("src/sale.py", source),
  );
  const edited = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/sale.py",
      source.replace("Implements title.", "Documents the same title contract."),
    ),
  );
  const changed = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "src/sale.py",
      source.replace('title = ""', 'title = "changed"'),
    ),
  );
  const removed = await adapter.analyze(
    EvidTestSourceSnapshot.create(
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
    EvidTestGraph.obligation(missing, 0, 0).missingUnitIds,
    reference.units
      .filter((unit) => unit.symbol === "h2")
      .map((unit) => unit.id),
  );

  // The comment may occur in an ancestor's header range as well as its own host.
  for (const unit of baseline.units) {
    TestValidator.equals(
      "annotation edits preserve the subtree fingerprint",
      EvidFingerprint.inspect(baseline, unit.id).fingerprint,
      EvidFingerprint.inspect(edited, unit.id).fingerprint,
    );
    TestValidator.notEquals(
      "member content changes its ancestors",
      EvidFingerprint.inspect(baseline, unit.id).fingerprint,
      EvidFingerprint.inspect(changed, unit.id).fingerprint,
    );
  }
}

/** Evaluates property claims against the selected Markdown heading.
 *
 * The graph enables single-host evidence and resolves only property units, so
 * the scenario cannot pass through an unacknowledged Python declaration.
 */
async function evaluate(
  claim: IEvidInventory,
  reference: IEvidInventory,
): Promise<IEvidGraphResult> {
  const selected = reference.units
    .filter((unit) => unit.symbol === "h2")
    .map((unit) => unit.id);
  return EvidGraph.evaluate({
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
            singleEvidPerSymbol: true,
            resolutions: await EvidTestGraph.resolveDeclarations(
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
