import { EvidenceDartAdapter, EvidenceInventory } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Resolves reciprocal parts and transitive show/hide aliases while preserving defining-library identities. */
export async function test_dart_libraries(): Promise<void> {
  const inventory = await new EvidenceDartAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/api.dart",
        dedent`
      library app.api;
      export 'bridge.dart' show Exported, excluded hide excluded;
      part 'models.dart';
      part 'generated.g.dart';
      int local() => 1;
    `,
      ),
      TestSourceSnapshot.create(
        "src/models.dart",
        dedent`
      part of 'api.dart';
      class Model { int value = 1; }
      class _Private { int child = 1; }
    `,
      ),
      TestSourceSnapshot.create(
        "src/generated.g.dart",
        "part of app.api; final generated = 1;",
      ),
      TestSourceSnapshot.create("src/bridge.dart", "export 'external.dart';"),
      TestSourceSnapshot.create(
        "src/external.dart",
        "class Exported { int value = 2; } final excluded = 1;",
      ),
      TestSourceSnapshot.create("other/independent.dart", "class Model {}"),
    ]),
  );

  TestValidator.equals("complete library graph", inventory.diagnostics, []);
  TestValidator.equals(
    "independent names do not merge across libraries",
    inventory.units.filter((unit) => unit.name === "Model").length,
    2,
  );
  const graph = new EvidenceInventory([inventory]);
  const ids = inventory.units.map((unit) => unit.id);
  for (const file of ["api.dart", "models.dart", "generated.g.dart"])
    for (const segments of [
      ["Model", "value"],
      ["local"],
      ["generated"],
      ["Exported", "value"],
    ])
      TestValidator.equals(
        `${file} sees library ${segments.join(".")}`,
        graph.resolve({ file: `/project/src/${file}`, segments }, ids).status,
        "resolved",
      );
  const physical = graph.resolve(
    { file: "/project/src/external.dart", segments: ["Exported", "value"] },
    ids,
  );
  const exported = graph.resolve(
    { file: "/project/src/api.dart", segments: ["Exported", "value"] },
    ids,
  );
  TestValidator.equals(
    "reexport shares identity",
    exported.units.map((unit) => unit.id),
    physical.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "hide removes only alias",
    graph.resolve(
      { file: "/project/src/api.dart", segments: ["excluded"] },
      ids,
    ).status,
    "missing",
  );
  TestValidator.equals(
    "hidden export remains selected at defining source",
    graph.resolve(
      { file: "/project/src/external.dart", segments: ["excluded"] },
      ids,
    ).status,
    "resolved",
  );
  TestValidator.predicate(
    "parts are exact watch dependencies",
    inventory.dependencies.some(
      (dependency) =>
        dependency.path === "/project/src/models.dart" && !dependency.recursive,
    ),
  );
}
