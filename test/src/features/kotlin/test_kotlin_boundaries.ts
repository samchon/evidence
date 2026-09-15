import { EvidenceKotlinAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Rejects unresolved Kotlin public surfaces while accepting explicit visibility
 * boundaries.
 *
 * Uncertain declarations cannot shrink coverage, while private counterparts
 * remain outside the denominator.
 *
 * 1. Analyze unresolved public forms. 2. Require incompleteness. 3. Verify
 *    explicit public and private cases select only the public surface.
 */
export async function test_kotlin_boundaries(): Promise<void> {
  const adapter = new EvidenceKotlinAdapter();
  const cases = new Map<string, string>([
    [
      "class Derived : Base() { override fun run() = 1; }\n",
      "kotlin-override-visibility",
    ],
    ["expect class Platform\n", "kotlin-multiplatform"],
    ["actual class Platform\n", "kotlin-multiplatform"],
    [
      "class Delegated(value: Service) : Service by value\n",
      "kotlin-delegation",
    ],
    ["val value by lazy { 1 }\n", "kotlin-delegation"],
    ["println(1)\n", "kotlin-source-form"],
    ["class Broken {\n", "kotlin-parse-incomplete"],
    // The upstream v1.1.0 external scanner requires a separator before a class-body close.
    ["class ValidKotlin { val value = 1 }\n", "kotlin-parse-incomplete"],
    ["fun <T> List<T>.items() = 1\n", "kotlin-receiver-unresolved"],
    ["fun Missing.work() = 1\n", "kotlin-receiver-unresolved"],
    [
      "import external.*\nfun Receiver.work() = 1\n",
      "kotlin-receiver-unresolved",
    ],
    [
      "typealias A = B\ntypealias B = A\nfun A.work() = 1\n",
      "kotlin-receiver-unresolved",
    ],
  ]);
  for (const [source, code] of cases) {
    const inventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("src/Boundary.kt", source),
    );
    TestValidator.equals(`incomplete ${code}`, inventory.complete, false);
    TestValidator.predicate(
      `actionable ${code}`,
      inventory.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === code && diagnostic.repair !== undefined,
      ),
    );
  }

  for (const source of [
    "class Derived : Base() { public override fun run() = 1; }\n",
    "private class Derived : Base() { override fun run() = 1; }\n",
    "private val value by lazy { 1 }\n",
    "fun run() { val local = 1; class Local }\n",
    "class Empty\nclass Next\n",
    "class Empty; class Next;\n",
    "import external.Receiver\nfun Receiver.work() = 1\n",
    "fun external.Receiver.work() = 1\n",
    "import external.*\nclass Receiver\nfun Receiver.work() = 1\n",
    "private fun <T> List<T>.items() = 1\n",
  ]) {
    const inventory = await adapter.analyze(
      EvidenceTestSourceSnapshot.create("src/Accepted.kt", source),
    );
    TestValidator.equals(`accepted ${source}`, inventory.diagnostics, []);
  }
  const script = await adapter.analyze(
    EvidenceTestSourceSnapshot.create("src/Script.kts", "val publicValue = 1\n"),
  );
  TestValidator.equals(
    "scripts do not become ordinary source",
    script.complete,
    false,
  );
  TestValidator.predicate(
    "script extension diagnostic",
    script.diagnostics.some(
      (diagnostic) => diagnostic.code === "kotlin-unsupported-extension",
    ),
  );
  const failed = await adapter.analyze(
    EvidenceTestSourceSnapshot.fail(
      EvidenceTestSourceSnapshot.create("src/Unavailable.kt", ""),
      {
        code: "path-unreadable",
        path: "/project/src/Unavailable.kt",
        message: "Unavailable",
      },
    ),
  );
  TestValidator.equals(
    "source failures survive empty analysis",
    failed.complete,
    false,
  );
}
