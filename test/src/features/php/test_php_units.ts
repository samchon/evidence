import { EvidAccessor, EvidInventory, EvidPhpAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Extracts PHP public units with namespace-aware ownership.
 *
 * Public defaults, independent declarators, property spelling, and namespace
 * imports determine the addressable population.
 *
 * 1. Analyze PHP namespaces, declarations, properties, and aliases.
 * 2. Verify exact units, identities, ownership, and target resolution.
 * 3. Require collision and unsupported cases to remain incomplete.
 */
export async function test_php_units(): Promise<void> {
  const source = dedent`
    <?php
    namespace App\\Domain;
    use Vendor\\{Original as Imported, Another};
    use function Vendor\\helper as helperAlias;
    use const Vendor\\VALUE as VALUE_ALIAS;
    /** Public contract. */
    #[Deprecated]
    class Contract {
      public int $first = 1, $second = 2;
      var $legacy = 0;
      protected int $protected = 0;
      private const SECRET = 0;
      const VALUE = 1;
      function run(): int { return 1; }
      public static function create(): int { return 2; }
      private function hidden() {}
      public function __construct(public readonly int $id, private string $secret) {}
    }
    interface Service { function call(): int; const LIMIT = 1; }
    trait Tools { function tool() {} }
    enum State: string { case READY = 'ready'; case STOPPED = 'stopped'; }
    function helper() {}
    const TOP = 1, NEXT = 2;
    ?>
    <div>More template</div>
    <?php
    function afterTemplate() {}
  `;
  const inventory = await new EvidPhpAdapter().analyze(
    EvidTestSourceSnapshot.create("src/contract.php", source, [
      "src/contract.php",
      "alias/contract.php",
    ]),
  );

  TestValidator.equals("complete PHP declarations", inventory.diagnostics, []);
  TestValidator.equals(
    "exact public PHP identity set",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort((a, b) => a.localeCompare(b)),
    [
      "type:App.Domain.Contract",
      "property:App.Domain.Contract.$first",
      "property:App.Domain.Contract.$second",
      "property:App.Domain.Contract.$legacy",
      "property:App.Domain.Contract.VALUE",
      "function:App.Domain.Contract.run",
      "function:App.Domain.Contract.create",
      "function:App.Domain.Contract.__construct",
      "property:App.Domain.Contract.$id",
      "type:App.Domain.Service",
      "function:App.Domain.Service.call",
      "property:App.Domain.Service.LIMIT",
      "type:App.Domain.Tools",
      "function:App.Domain.Tools.tool",
      "type:App.Domain.State",
      "property:App.Domain.State.READY",
      "property:App.Domain.State.STOPPED",
      "function:App.Domain.helper",
      "property:App.Domain.TOP",
      "property:App.Domain.NEXT",
      "function:App.Domain.afterTemplate",
    ].sort((a, b) => a.localeCompare(b)),
  );
  const graph = new EvidInventory([inventory]);
  const selected = inventory.units.map((unit) => unit.id);
  TestValidator.equals(
    "file alias preserves property address",
    graph.resolve(
      {
        file: "/project/alias/contract.php",
        segments: ["App", "Domain", "Contract", "$first"],
      },
      selected,
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "imports do not invent declarations",
    graph.resolve(
      {
        file: "/project/src/contract.php",
        segments: ["App", "Domain", "Imported"],
      },
      selected,
    ).status,
    "missing",
  );
  const child = inventory.units.find((unit) => unit.name === "$id");
  TestValidator.equals(
    "promoted property belongs to type",
    inventory.units.find((unit) => unit.id === child?.parentId)?.name,
    "Contract",
  );
  TestValidator.equals(
    "canonical accessor retains dollar sign",
    EvidAccessor.format(["App", "Domain", "Contract", "$first"]),
    "App.Domain.Contract.$first",
  );

  const unicode = await new EvidPhpAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "unicode.php",
      "<?php class \u00c0 {} class \u00e0 {}",
    ),
  );
  TestValidator.equals(
    "non-ASCII PHP names remain distinct",
    unicode.complete,
    true,
  );
  TestValidator.equals(
    "non-ASCII declarations preserved",
    unicode.units.map((unit) => unit.name),
    ["\u00c0", "\u00e0"],
  );

  const brackets = await new EvidPhpAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "brackets.php",
      "<?php namespace One { class Same {} } namespace Two { class Same {} } namespace { function globalRun() {} }",
    ),
  );
  TestValidator.equals(
    "bracketed namespace scopes remain disjoint",
    brackets.units
      .map((unit) => unit.identity)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    [["One", "Same"], ["Two", "Same"], ["globalRun"]].sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
    ),
  );

  const colliding = await new EvidPhpAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "collision.php",
      "<?php namespace App \\ Domain; class Shared {} function Shared() {} const Value = 1, value = 2;",
    ),
  );
  TestValidator.equals(
    "separate PHP name spaces remain complete",
    colliding.complete,
    true,
  );
  TestValidator.equals(
    "namespace whitespace is not part of identity",
    colliding.units
      .map((unit) => unit.identity)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    [
      ["App", "Domain", "Shared"],
      ["App", "Domain", "Shared"],
      ["App", "Domain", "Value"],
      ["App", "Domain", "value"],
    ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
  const collisionGraph = new EvidInventory([colliding]);
  const collisionAddress = {
    file: "/project/collision.php",
    segments: ["App", "Domain", "Shared"],
  };
  TestValidator.equals(
    "type and function with same spelling are ambiguous together",
    collisionGraph.resolve(
      collisionAddress,
      colliding.units.map((unit) => unit.id),
    ).status,
    "ambiguous",
  );
  TestValidator.equals(
    "selector disambiguates independent PHP names",
    collisionGraph.resolve(
      collisionAddress,
      colliding.units
        .filter((unit) => unit.symbol === "function")
        .map((unit) => unit.id),
    ).status,
    "resolved",
  );
}
