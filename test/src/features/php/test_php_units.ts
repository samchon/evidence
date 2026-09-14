import {
  EvidenceAccessor,
  EvidenceInventory,
  EvidencePhpAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Verifies namespace ownership, public defaults, independent declarators, and PHP property spelling. */
export async function test_php_units(): Promise<void> {
  const source = dedent`
    <html>Template before code</html>
    <?php
    namespace App\\Domain;
    use Vendor\\Original as Imported;
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
  const inventory = await new EvidencePhpAdapter().analyze(
    TestSourceSnapshot.create("src/contract.php", source, [
      "src/contract.php",
      "alias/contract.php",
    ]),
  );

  TestValidator.equals("complete PHP declarations", inventory.diagnostics, []);
  TestValidator.equals(
    "exact public PHP identity set",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort(),
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
    ].sort(),
  );
  const graph = new EvidenceInventory([inventory]);
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
    EvidenceAccessor.format(["App", "Domain", "Contract", "$first"]),
    "App.Domain.Contract.$first",
  );

  const brackets = await new EvidencePhpAdapter().analyze(
    TestSourceSnapshot.create(
      "brackets.php",
      "<?php namespace One { class Same {} } namespace Two { class Same {} } namespace { function globalRun() {} }",
    ),
  );
  TestValidator.equals(
    "bracketed namespace scopes remain disjoint",
    brackets.units.map((unit) => unit.identity),
    [["One", "Same"], ["Two", "Same"], ["globalRun"]],
  );
}
