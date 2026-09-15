import { EvidenceKotlinAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Resolves Kotlin extension receivers across nominal names and selected
 * aliases.
 *
 * Equivalent receiver spelling must resolve one semantic extension without
 * duplicate obligations.
 *
 * 1. Analyze qualified receivers and aliases. 2. Resolve their extension targets.
 *    3. Compare the resulting unit identities.
 */
export async function test_kotlin_receiver_identity(): Promise<void> {
  const snapshot = EvidenceTestSourceSnapshot.combine([
    EvidenceTestSourceSnapshot.create(
      "src/Receiver.kt",
      dedent`
      package example
      class Receiver
      typealias Alias = Receiver
      fun Receiver.work() = 1
      fun String.sizeHint() = 1
    `,
    ),
    EvidenceTestSourceSnapshot.create(
      "src/Extensions.kt",
      dedent`
      package example
      import example.Alias as Renamed
      fun example.Receiver.work(value: Int) = value
      fun Renamed.work(value: String) = value
      fun kotlin.String.sizeHint(value: Int) = value
    `,
    ),
  ]);
  const inventory = await new EvidenceKotlinAdapter().analyze(snapshot);

  TestValidator.equals("resolved nominal receivers", inventory.diagnostics, []);
  const functions = inventory.units.filter(
    (unit) => unit.symbol === "function",
  );
  TestValidator.equals("one family per semantic receiver", functions.length, 2);
  const work = functions.find((unit) => unit.name === "work");
  const string = functions.find((unit) => unit.name === "sizeHint");
  TestValidator.equals(
    "bare, qualified, and alias sites",
    work === undefined ? 0 : work.sites.length,
    3,
  );
  TestValidator.equals(
    "default and explicit Kotlin imports",
    string === undefined ? 0 : string.sites.length,
    2,
  );

  // Same-spelled private aliases belong to their own file even inside one package.
  const privateAliases = await new EvidenceKotlinAdapter().analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/Text.kt",
        "package example\nprivate typealias Local = String\nfun Local.run() = 1\n",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/Number.kt",
        "package example\nprivate typealias Local = Int\nfun Local.run() = 2\n",
      ),
    ]),
  );
  TestValidator.equals(
    "file-private receiver aliases resolve independently",
    privateAliases.diagnostics,
    [],
  );
  TestValidator.equals(
    "private aliases do not invent public type units",
    privateAliases.units
      .map((unit) => unit.identity.at(-2))
      .sort((a, b) => String(a).localeCompare(String(b))),
    ["extension(kotlin.Int)", "extension(kotlin.String)"],
  );
  const inaccessible = await new EvidenceKotlinAdapter().analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/Private.kt",
        "private typealias Local = String\n",
      ),
      EvidenceTestSourceSnapshot.create("src/Use.kt", "fun Local.run() = 1\n"),
    ]),
  );
  TestValidator.equals(
    "private alias cannot leak to another source",
    inaccessible.complete,
    false,
  );
}
