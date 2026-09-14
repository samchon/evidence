import { EvidenceFingerprint, EvidencePhpAdapter } from "@wrtnlabs/evidence";
import type { IEvidenceInventory } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Invalidates PHP reviews for property hooks and namespace import changes while isolating sibling declarators. */
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

/** Analyzes a single independent source revision. */
async function analyze(content: string): Promise<IEvidenceInventory> {
  return new EvidencePhpAdapter().analyze(
    TestSourceSnapshot.create("src/contract.php", content),
  );
}

/** Looks up a unique declaration's review fingerprint. */
function fingerprint(inventory: IEvidenceInventory, name: string): string {
  const unit = inventory.units.find((item) => item.name === name);
  if (unit === undefined) throw new Error(`Missing PHP unit ${name}`);
  return EvidenceFingerprint.inspect(inventory, unit.id).fingerprint;
}
