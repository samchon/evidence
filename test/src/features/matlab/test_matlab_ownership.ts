import { EvidenceInventory, EvidenceMatlabAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps external methods in their selected package class, including prototype visibility and dependencies. */
export async function test_matlab_ownership(): Promise<void> {
  const cls = TestSourceSnapshot.create(
    "src/+pkg/@Widget/Widget.m",
    dedent`
    classdef Widget
      methods
        run(obj)
      end
      methods (Access=private)
        secret(obj)
      end
    end
  `,
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
  const inventory = await new EvidenceMatlabAdapter().analyze(
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
  const method = inventory.units.find((unit) => unit.name === "run");
  TestValidator.equals(
    "prototype and implementation merge",
    method?.sites?.length,
    2,
  );
  const graph = new EvidenceInventory([inventory]);
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
  const missing = await new EvidenceMatlabAdapter().analyze(run);
  TestValidator.equals("missing class cannot pass", missing.complete, false);
  TestValidator.predicate(
    "actionable legacy boundary",
    missing.diagnostics.some(
      (diagnostic) => diagnostic.code === "matlab-class-folder",
    ),
  );
  const missingImplementation = await new EvidenceMatlabAdapter().analyze(cls);
  TestValidator.equals(
    "missing implementations cannot pass",
    missingImplementation.complete,
    false,
  );
}
