import { EvidFingerprint, EvidPhpAdapter } from "evid";
import type { IEvidInventory } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Tracks PHP review fingerprints across semantic ownership changes.
 *
 * Property hooks and namespace imports affect cited meaning, while unrelated
 * sibling declarations remain isolated.
 *
 * 1. Analyze documented PHP declarations with hooks and imports.
 * 2. Apply annotation, sibling, hook, and import edits.
 * 3. Verify only semantic changes to the cited unit invalidate its review.
 */
export async function test_php_fingerprints(): Promise<void> {
  const content = dedent`
    <?php
    namespace App;
    use Vendor\\First as Value;
    class Contract {
      /** Shared documentation. */
      public int $first = 1, $second = 2;
      public private(set) string $hook { get => 'initial'; }
      public function run(Value $value): Value { return $value; }
    }
  `;
  const original = await analyze(content);
  const sibling = await analyze(content.replace("$second = 2", "$second = 3"));
  const hook = await analyze(content.replace("'initial'", "'changed'"));
  const imported = await analyze(
    content.replace("Vendor\\First", "Vendor\\Second"),
  );
  const annotation = await analyze(
    content.replace(
      "Shared documentation.",
      "@evidenceReview ./requirements.md#value Annotation edit.",
    ),
  );

  TestValidator.equals(
    "supported hooked and asymmetric properties",
    original.diagnostics,
    [],
  );
  TestValidator.equals(
    "public getter remains selected",
    original.units.filter((unit) => unit.name === "$hook").length,
    1,
  );
  TestValidator.equals(
    "unmodified sibling preserves fingerprint",
    fingerprint(original, "$first"),
    fingerprint(sibling, "$first"),
  );
  TestValidator.notEquals(
    "changed sibling invalidates fingerprint",
    fingerprint(original, "$second"),
    fingerprint(sibling, "$second"),
  );
  TestValidator.notEquals(
    "hook expression contributes content",
    fingerprint(original, "$hook"),
    fingerprint(hook, "$hook"),
  );
  TestValidator.notEquals(
    "namespace alias target contributes meaning",
    fingerprint(original, "run"),
    fingerprint(imported, "run"),
  );
  TestValidator.equals(
    "review-only edit preserves fingerprint",
    fingerprint(original, "Contract"),
    fingerprint(annotation, "Contract"),
  );
}

/**
 * Analyzes one independent PHP source revision for fingerprint comparison.
 *
 * Each caller receives a fresh inventory so a single textual mutation cannot
 * share parser or inventory state with the baseline revision.
 */
async function analyze(content: string): Promise<IEvidInventory> {
  return new EvidPhpAdapter().analyze(
    EvidTestSourceSnapshot.create("src/contract.php", content),
  );
}

/**
 * Reads the review fingerprint for one uniquely named PHP declaration.
 *
 * A missing name fails the scenario immediately because the comparison cannot
 * establish fingerprint behavior without its intended semantic unit.
 */
function fingerprint(inventory: IEvidInventory, name: string): string {
  const unit = inventory.units.find((item) => item.name === name);
  if (unit === undefined) throw new Error(`Missing PHP unit ${name}`);
  return EvidFingerprint.inspect(inventory, unit.id).fingerprint;
}
