import { EvidenceAccessor, EvidenceScalaAdapter } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Builds Scala identities across packages, companion namespaces, and literal
 * names.
 *
 * The fixture combines chained and braced packages with companion objects,
 * implicit declarations, an implicit class, type aliases, and backticked
 * segments.
 *
 * 1. Analyze the package fixture and require no diagnostics.
 * 2. Verify the exact symbol-qualified identities for package, companion,
 *    implicit, extension, alias, and literal declarations.
 * 3. Verify implicit conversion syntax creates no extra hosts beyond discovered
 *    units.
 */
export async function test_scala_packages(): Promise<void> {
  const inventory = await new EvidenceScalaAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "src/Packages.scala",
      dedent`
    package outer
    package nested {
      class Contract
      object Contract {
        implicit val defaultValue: Int = 1
        implicit def convert(value: Int): String = value.toString
        implicit class Extra(val value: Int) { def doubled = value * 2 }
        type Name = String
        def \`literal.name\` = 1
      }
    }
    package \`literal.package\` { trait Contract { type Item } }
    class Top
  `,
    ),
  );
  TestValidator.equals(
    "package and implicit declarations complete",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "exact package identities",
    inventory.units
      .map((unit) => `${unit.symbol}:${EvidenceAccessor.format(unit.identity)}`)
      .sort((a, b) => a.localeCompare(b, "en")),
    [
      "type:outer.nested.Contract",
      'type:outer.nested["object Contract"]',
      'property:outer.nested["object Contract"].defaultValue',
      'function:outer.nested["object Contract"].convert',
      'type:outer.nested["object Contract"].Extra',
      'property:outer.nested["object Contract"].Extra.value',
      'function:outer.nested["object Contract"].Extra.doubled',
      'type:outer.nested["object Contract"].Name',
      'function:outer.nested["object Contract"]["literal.name"]',
      'type:outer["literal.package"].Contract',
      'type:outer["literal.package"].Contract.Item',
      "type:outer.Top",
    ].sort((a, b) => a.localeCompare(b, "en")),
  );
  TestValidator.equals(
    "implicit conversion synthesis creates no extra hosts",
    inventory.hosts.length,
    inventory.units.length,
  );
}
