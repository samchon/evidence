import { EvidenceFingerprint, EvidenceTypeScriptAdapter } from "@wrtnlabs/evidence";
import type { IEvidenceInventory, IEvidenceUnit } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Fingerprints TypeScript declaration content independently of annotations and
 * siblings.
 *
 * Reviews must expire for semantic source changes while remaining stable when
 * only review metadata or checkout formatting changes. Leaf content also needs
 * narrower ownership than its enclosing statement or the complete source file.
 *
 * 1. Extract a type, a documented member, an unrelated type, and sibling variable
 *    declarators; require version two, a seven-character presentation, and a
 *    declaration content digest distinct from the source-cache digest.
 * 2. Mark the inventory incomplete and require fingerprint inspection to reject.
 * 3. Change review hash/prose, line endings, and trailing whitespace; require the
 *    enclosing type's fingerprint to remain unchanged.
 * 4. Change the member's type and require both leaf and enclosing-scope
 *    fingerprints to change; alter an ordinary inline comment and require the
 *    leaf to change.
 * 5. Edit the unrelated type and second variable declarator, then require the
 *    original type scope and first declarator fingerprint to remain stable.
 */
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

  TestValidator.equals("fingerprint version", saleFingerprint.version, 2);
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

/**
 * Extracts each content variant under the same TypeScript source identity.
 *
 * Keeping the path fixed ensures comparisons isolate edited declaration content
 * rather than fingerprint changes caused by rebinding to another source.
 */
async function analyze(content: string): Promise<IEvidenceInventory> {
  return new EvidenceTypeScriptAdapter().analyze(
    EvidenceTestSourceSnapshot.create("src/contracts.ts", content),
  );
}

/**
 * Requires a named declaration before comparing its fingerprint across
 * variants.
 *
 * Missing extraction fails explicitly instead of comparing an unrelated
 * fallback unit.
 */
function requireUnit(inventory: IEvidenceInventory, name: string): IEvidenceUnit {
  const unit = inventory.units.find((candidate) => candidate.name === name);
  if (unit === undefined) throw new Error(`Missing fingerprint unit: ${name}`);
  return unit;
}
