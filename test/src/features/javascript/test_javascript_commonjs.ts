import { EvidenceJavaScriptAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Publishes the bounded CommonJS surface with replacement and alias semantics.
 *
 * Assignment order determines exported identity and aliases cannot expose an unproved dynamic surface.
 *
 * 1. Analyze CommonJS replacement and alias assignments. 2. Compare exported units. 3. Require unsupported dynamic exports to remain incomplete.
 */
export async function test_javascript_commonjs(): Promise<void> {
  const inventory = await new EvidenceJavaScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/contracts.cjs",
      dedent`
        /** @evidence docs/spec.md#run Implements the CommonJS function. */
        function run() {}
        class Service { execute() {} }
        const value = 1;
        const late = 2;
        const lost = 3;

        exports.lost = lost;
        module.exports = { run, Service, answer: value };
        exports.lost = lost;
        module.exports.late = late;
        exports = module.exports;
        exports.alias = run;
      `,
    ),
  );

  TestValidator.equals(
    "CommonJS addresses",
    inventory.addresses
      .map((address) => address.segments.join("."))
      .sort(compare),
    ["Service", "Service.prototype.execute", "alias", "answer", "late", "run"],
  );
  TestValidator.equals(
    "complete CommonJS inventory",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "CommonJS declaration host",
    inventory.declarations.map((declaration) => declaration.target),
    ["docs/spec.md#run"],
  );

  const runAliases = inventory.addresses
    .filter((address) => ["alias", "run"].includes(address.segments[0] ?? ""))
    .map((address) => address.unitId);
  TestValidator.equals(
    "CommonJS aliases retain identity",
    new Set(runAliases).size,
    1,
  );

  // Replacing the module with one local declaration exposes that declaration as default.
  const replaced = await new EvidenceJavaScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/default.cjs",
      dedent`
        class Contract { value = 1; }
        module.exports = Contract;
      `,
    ),
  );
  TestValidator.equals(
    "CommonJS default replacement",
    replaced.addresses
      .map((address) => address.segments.join("."))
      .sort(compare),
    ["default", "default.prototype.value"],
  );
  TestValidator.equals(
    "complete default replacement",
    replaced.diagnostics,
    [],
  );

  const noOp = await new EvidenceJavaScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/no-op.cjs",
      dedent`
        function run() {}
        module.exports = exports;
        exports = exports;
        exports.run = run;
      `,
    ),
  );
  TestValidator.equals(
    "CommonJS identity assignments",
    noOp.addresses.map((address) => address.segments.join(".")),
    ["run"],
  );
  TestValidator.equals("complete identity assignments", noOp.diagnostics, []);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
