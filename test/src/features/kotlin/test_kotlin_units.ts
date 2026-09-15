import { EvidenceAccessor, EvidenceInventory, EvidenceKotlinAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Classifies public Kotlin declarations across owners, overloads, and file
 * aliases.
 *
 * The denominator retains lexical ownership and overload sites without merging
 * unrelated file aliases.
 *
 * 1. Analyze public Kotlin forms. 2. Compare unit identities and symbols. 3.
 *    Verify overload and alias ownership.
 */
export async function test_kotlin_units(): Promise<void> {
  const snapshot = EvidenceTestSourceSnapshot.combine([
    EvidenceTestSourceSnapshot.create(
      "src/Contract.kt",
      dedent`
      package example

      /** Public contract. */
      @Deprecated("old")
      class Contract(val value: Int, private var secret: Int) {
        var readable: Int = 0
          private set
        fun run(): Int = 1
        fun run(value: Int): Int = value
        companion object {
          fun run(): Int = 2
        }
        object Nested {
          val flag = true
        }
        private class Hidden { public val child = 1; }
        internal val internalValue = 1
        protected val protectedValue = 2
      }
      typealias ContractName = Contract
      enum class State { READY, STOPPED; }
      interface Service { fun call(): Int; }
      object Factory { val active = true; }
      internal class Internal { public fun child() = 1; }
      private fun privateFunction() = 1
      fun String.measure(): Int = 1
      fun Int.measure(): Int = 2
    `,
      ["src/Contract.kt", "alias/Contract.kt"],
    ),
    EvidenceTestSourceSnapshot.create(
      "src/Additional.kt",
      dedent`
      package example
      import example.Contract as Imported

      fun Imported.check(): Int = 1
      fun example.Contract.check(value: Int): Int = value
      class Named { companion object Tools { val ready = true; }; }
    `,
    ),
  ]);
  const inventory = await new EvidenceKotlinAdapter().analyze(snapshot);

  TestValidator.equals("complete Kotlin surface", inventory.diagnostics, []);
  TestValidator.equals(
    "exact declarations",
    inventory.units
      .map((unit) => `${unit.symbol}:${EvidenceAccessor.format(unit.identity)}`)
      .sort((a, b) => a.localeCompare(b)),
    [
      "type:example.Contract",
      "property:example.Contract.value",
      "property:example.Contract.readable",
      "function:example.Contract.run",
      "type:example.Contract.Companion",
      "function:example.Contract.Companion.run",
      "type:example.Contract.Nested",
      "property:example.Contract.Nested.flag",
      "type:example.ContractName",
      "type:example.State",
      "property:example.State.READY",
      "property:example.State.STOPPED",
      "type:example.Service",
      "function:example.Service.call",
      "type:example.Factory",
      "property:example.Factory.active",
      'function:example["extension(kotlin.String)"].measure',
      'function:example["extension(kotlin.Int)"].measure',
      'function:example["extension(example.Contract)"].check',
      "type:example.Named",
      "type:example.Named.Tools",
      "property:example.Named.Tools.ready",
    ].sort((a, b) => a.localeCompare(b)),
  );
  const overload = inventory.units.find((unit) => unit.name === "check");
  TestValidator.equals(
    "import aliases normalize receiver overloads",
    overload === undefined ? 0 : overload.sites.length,
    2,
  );
  const run = inventory.units.find(
    (unit) => unit.identity.join(".") === "example.Contract.run",
  );
  TestValidator.equals(
    "ordinary overload family",
    run === undefined ? 0 : run.sites.length,
    2,
  );
  TestValidator.equals(
    "all public sites retain eligible hosts",
    inventory.hosts.length,
    inventory.units.reduce((sum, unit) => sum + unit.sites.length, 0),
  );
  const selected = inventory.units.map((unit) => unit.id);
  const graph = new EvidenceInventory([inventory]);
  TestValidator.equals(
    "logical file alias resolves same unit",
    graph.resolve(
      { file: "/project/alias/Contract.kt", segments: ["Contract", "value"] },
      selected,
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "private child is not public",
    graph.resolve(
      {
        file: "/project/src/Contract.kt",
        segments: ["Contract", "Hidden", "child"],
      },
      selected,
    ).status,
    "missing",
  );
}
