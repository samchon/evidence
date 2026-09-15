import { EvidInventory, EvidMatlabAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Assigns external MATLAB methods to their selected package class.
 *
 * Class prototypes and implementation files describe one owner; missing or wrongly aliased class context must not create a passing inventory.
 *
 * 1. Combine a package class with external public, private, and additional method files.
 * 2. Verify merged identities, prototype evidence, supported addresses, and ownership dependencies.
 * 3. Reverse snapshot order and require the same result.
 * 4. Require missing class or implementation inputs to remain incomplete.
 */
export async function test_matlab_ownership(): Promise<void> {
  const cls = TestSourceSnapshot.create(
    "src/+pkg/@Widget/Widget.m",
    dedent`
    classdef Widget
      methods
        % @evid doc.md#prototype Documents the external method contract.
        run(obj)
      end
      methods (Access=private)
        secret(obj)
      end
    end
  `.concat("\n"),
  );
  const run = TestSourceSnapshot.create(
    "src/+pkg/@Widget/run.m",
    "function run(obj)\n% Method help.\nend\n",
  );
  const secret = TestSourceSnapshot.create(
    "src/+pkg/@Widget/secret.m",
    "function secret(obj)\nend\n",
  );
  const additional = TestSourceSnapshot.create(
    "src/+pkg/@Widget/extra.m",
    "function extra(obj)\nend\n",
  );
  const inventory = await new EvidMatlabAdapter().analyze(
    TestSourceSnapshot.combine([cls, run, secret, additional]),
  );

  TestValidator.equals(
    "complete selected class folder",
    inventory.diagnostics,
    [],
  );
  TestValidator.equals(
    "exact package ownership",
    inventory.units
      .map((unit) => unit.identity.join("."))
      .sort((left, right) => left.localeCompare(right)),
    ["pkg.Widget", "pkg.Widget.extra", "pkg.Widget.run"],
  );
  TestValidator.equals(
    "signature-only documentation owns the method",
    inventory.declarations.map((declaration) => declaration.target),
    ["doc.md#prototype"],
  );
  const method = inventory.units.find((unit) => unit.name === "run");
  TestValidator.equals(
    "prototype and implementation merge",
    method?.sites?.length,
    2,
  );
  const graph = new EvidInventory([inventory]);
  for (const file of ["Widget.m", "run.m"])
    TestValidator.equals(
      `external address ${file}`,
      graph.resolve(
        {
          file: `/project/src/+pkg/@Widget/${file}`,
          segments: ["pkg", "Widget", "run"],
        },
        inventory.units.map((unit) => unit.id),
      ).status,
      "resolved",
    );
  TestValidator.equals(
    "unlisted external method class alias",
    graph.resolve(
      {
        file: "/project/src/+pkg/@Widget/Widget.m",
        segments: ["pkg", "Widget", "extra"],
      },
      inventory.units.map((unit) => unit.id),
    ).status,
    "resolved",
  );
  TestValidator.equals(
    "wrong external alias remains missing",
    graph.resolve(
      {
        file: "/project/src/+pkg/@Widget/run.m",
        segments: ["pkg", "Widget", "extra"],
      },
      inventory.units.map((unit) => unit.id),
    ).status,
    "missing",
  );
  TestValidator.predicate(
    "owner invalidation dependency",
    inventory.dependencies.some((dependency) =>
      dependency.path.endsWith("/@Widget/Widget.m"),
    ),
  );
  TestValidator.predicate(
    "new method discovery dependency",
    inventory.dependencies.some(
      (dependency) =>
        dependency.recursive && dependency.path.endsWith("/@Widget"),
    ),
  );
  const reversed = await new EvidMatlabAdapter().analyze(
    TestSourceSnapshot.combine([additional, secret, run, cls]),
  );
  TestValidator.equals(
    "snapshot order does not alter ownership",
    reversed,
    inventory,
  );
  const missing = await new EvidMatlabAdapter().analyze(run);
  TestValidator.equals("missing class cannot pass", missing.complete, false);
  TestValidator.predicate(
    "actionable legacy boundary",
    missing.diagnostics.some(
      (diagnostic) => diagnostic.code === "matlab-class-folder",
    ),
  );
  const missingImplementation = await new EvidMatlabAdapter().analyze(cls);
  TestValidator.equals(
    "missing implementations cannot pass",
    missingImplementation.complete,
    false,
  );
}
