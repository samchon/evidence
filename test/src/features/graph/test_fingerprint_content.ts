import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceFingerprint } from "../../../../packages/evidence/src/EvidenceFingerprint";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/EvidenceTypeScriptAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps TypeScript fingerprints on semantic declaration content. */
export async function test_fingerprint_content(): Promise<void> {
  const baseline = dedent`
    export interface Sale {
      /** @evidenceReview docs/rules.md#price #abcdef0 Read the price rule. */
      price: /* Currency amount. */ number;
    }

    export interface Unrelated {
      label: string;
    }

    export const first = 1, second = 2;
  `;
  const original = await analyze(baseline);
  const sale = requireUnit(original, "Sale");
  const price = requireUnit(original, "price");
  const first = requireUnit(original, "first");
  const saleFingerprint = EvidenceFingerprint.inspect(original, sale.id);
  const priceFingerprint = EvidenceFingerprint.inspect(original, price.id);
  const firstFingerprint = EvidenceFingerprint.inspect(original, first.id);

  TestValidator.equals("fingerprint version", saleFingerprint.version, 1);
  TestValidator.equals(
    "presented fingerprint length",
    saleFingerprint.fingerprint.length,
    7,
  );
  TestValidator.equals(
    "cache and content digests stay separate",
    saleFingerprint.contentDigest === original.sources[0]?.digest,
    false,
  );

  // Partial analysis cannot expose a digest that callers could mistake for complete content.
  const incomplete = structuredClone(original);
  incomplete.complete = false;

  await TestValidator.error("incomplete inventory", async () =>
    EvidenceFingerprint.inspect(incomplete, sale.id),
  );

  // Annotation prose, fingerprints, and checkout line endings do not change reviewed content.
  const annotated = await analyze(
    baseline
      .replace("#abcdef0 Read the price rule.", "#1234567 Re-read it twice.")
      .replaceAll("\n", " \t\r\n"),
  );

  TestValidator.equals(
    "annotation, line endings, and trailing whitespace ignored",
    EvidenceFingerprint.inspect(annotated, requireUnit(annotated, "Sale").id)
      .fingerprint,
    saleFingerprint.fingerprint,
  );

  // A member edit moves its own digest and the enclosing scope.
  const changedMember = await analyze(
    baseline.replace(
      "price: /* Currency amount. */ number",
      "price: /* Currency amount. */ bigint",
    ),
  );

  TestValidator.equals(
    "member content expires leaf review",
    EvidenceFingerprint.inspect(
      changedMember,
      requireUnit(changedMember, "price").id,
    ).fingerprint === priceFingerprint.fingerprint,
    false,
  );
  TestValidator.equals(
    "member content expires container review",
    EvidenceFingerprint.inspect(
      changedMember,
      requireUnit(changedMember, "Sale").id,
    ).fingerprint === saleFingerprint.fingerprint,
    false,
  );

  // Ordinary comments remain semantic source content because they cannot host tags.
  const changedComment = await analyze(
    baseline.replace("Currency amount.", "Gross currency amount."),
  );

  TestValidator.equals(
    "ordinary comment expires leaf review",
    EvidenceFingerprint.inspect(
      changedComment,
      requireUnit(changedComment, "price").id,
    ).fingerprint === priceFingerprint.fingerprint,
    false,
  );

  // Unrelated declarations and sibling variable declarators stay outside a leaf digest.
  const changedSiblings = await analyze(
    baseline
      .replace("label: string", "label: bigint")
      .replace("second = 2", "second = 200"),
  );

  TestValidator.equals(
    "unrelated declaration preserves scope",
    EvidenceFingerprint.inspect(
      changedSiblings,
      requireUnit(changedSiblings, "Sale").id,
    ).fingerprint,
    saleFingerprint.fingerprint,
  );
  TestValidator.equals(
    "sibling declarator preserves leaf",
    EvidenceFingerprint.inspect(
      changedSiblings,
      requireUnit(changedSiblings, "first").id,
    ).fingerprint,
    firstFingerprint.fingerprint,
  );
}

async function analyze(content: string): Promise<IEvidenceInventory> {
  return new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create("src/contracts.ts", content),
  );
}

function requireUnit(
  inventory: IEvidenceInventory,
  name: string,
): IEvidenceUnit {
  const unit = inventory.units.find((candidate) => candidate.name === name);
  if (unit === undefined) throw new Error(`Missing fingerprint unit: ${name}`);
  return unit;
}
