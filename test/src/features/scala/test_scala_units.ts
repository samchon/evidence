import typia from "typia";
import type { IEvidenceInventory } from "@wrtnlabs/evidence";
import {
  EvidenceAccessor,
  EvidenceInventory,
  EvidenceScalaAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Certifies independent Scala 2/3 source ownership, visibility, overloads and constructor bindings. */
export async function test_scala_units(): Promise<void> {
  const inventory = await new EvidenceScalaAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/Scala2.scala",
        dedent`
      package demo
      /** Contract. */
      case class Contract(value: Int, private val secret: Int)(ordinary: Int) {
        val readable = 1
        def run(): Int = 1
        def run(value: Int): Int = value
        def this() = this(1, 2)(3)
        private class Hidden { val child = 1 }
        protected val restricted = 2
        private[demo] val packageOnly = 3
        private[this] val instanceOnly = 4
        def locals = { class Local; val local = 1; local }
      }
      object Contract { def apply() = 2 }
      trait Service { def call(): Int; val name: String; type Element }
      package object util { val ready = true }
      type ContractName = Contract
      private object Hidden { val child = 1 }
      class Constructor private (val exposed: Int)
    `,
        ["src/Scala2.scala", "alias/Scala2.scala"],
      ),
      TestSourceSnapshot.create(
        "src/Scala3.scala",
        dedent`
      package demo
      object Modern:
        given order: Ordering[Int] with
          def compare(x: Int, y: Int) = x - y
        extension (value: String)
          def measure = value.length
        extension (value: Int)
          def measure = value
        val left, right = 1
        val (first, second) = (1, 2)
        val \`value.part\` = 3
      enum State:
        case Ready, Stopped
        case Value(number: Int)
    `,
      ),
    ]),
  );
  TestValidator.equals("Scala surface diagnostics", inventory.diagnostics, []);
  TestValidator.equals(
    "exact independent surface",
    inventory.units
      .map((unit) => `${unit.symbol}:${EvidenceAccessor.format(unit.identity)}`)
      .sort((a, b) => a.localeCompare(b, "en")),
    [
      "type:demo.Contract",
      "property:demo.Contract.value",
      "property:demo.Contract.readable",
      "function:demo.Contract.run",
      "function:demo.Contract.locals",
      'type:demo["object Contract"]',
      'function:demo["object Contract"].apply',
      "type:demo.Service",
      "function:demo.Service.call",
      "property:demo.Service.name",
      "type:demo.Service.Element",
      'type:demo["package object util"]',
      'property:demo["package object util"].ready',
      "type:demo.ContractName",
      "type:demo.Constructor",
      "property:demo.Constructor.exposed",
      'type:demo["object Modern"]',
      'property:demo["object Modern"].order',
      'function:demo["object Modern"].order.compare',
      'function:demo["object Modern"].measure',
      'property:demo["object Modern"].left',
      'property:demo["object Modern"].right',
      'property:demo["object Modern"].first',
      'property:demo["object Modern"].second',
      'property:demo["object Modern"]["value.part"]',
      "type:demo.State",
      "property:demo.State.Ready",
      "property:demo.State.Stopped",
      "type:demo.State.Value",
      "property:demo.State.Value.number",
    ].sort((a, b) => a.localeCompare(b, "en")),
  );
  TestValidator.equals(
    "overload families",
    inventory.units
      .filter((unit) => ["run", "measure"].includes(unit.name))
      .map((unit) => unit.sites.length),
    [2, 2],
  );
  const graph = new EvidenceInventory([inventory]);
  TestValidator.equals(
    "logical aliases share identity",
    graph.resolve(
      {
        file: "/project/alias/Scala2.scala",
        segments: ["demo", "Contract", "value"],
      },
      inventory.units.map((unit) => unit.id),
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "synthetic case-class apply is absent",
    graph.resolve(
      {
        file: "/project/src/Scala2.scala",
        segments: ["demo", "Contract", "apply"],
      },
      inventory.units.map((unit) => unit.id),
    ).status,
    "missing",
  );
  TestValidator.equals(
    "source inventory serializes",
    typia.assert<IEvidenceInventory>(JSON.parse(JSON.stringify(inventory))),
    inventory,
  );
}
