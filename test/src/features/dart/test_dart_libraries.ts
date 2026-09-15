import { EvidenceDartAdapter, EvidenceInventory } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Resolves Dart parts and transitive export aliases while preserving
 * defining-library identity.
 *
 * A library's parts share visible members and reexports share semantic units,
 * but aliases do not erase defining source ownership or hidden-export
 * boundaries.
 *
 * 1. Analyze a library with reciprocal parts, generated part, transitive export,
 *    show/hide clauses, and an independent file.
 * 2. Resolve library-visible local, part, generated, and reexported members from
 *    every part file.
 * 3. Require the hidden alias to be missing only through the API, retain its
 *    defining-source resolution, and record parts as exact dependencies.
 */
export async function test_dart_libraries(): Promise<void> {
  const inventory = await new EvidenceDartAdapter().analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/api.dart",
        dedent`
      library app.api;
      export 'bridge.dart' show Exported, excluded hide excluded;
      part 'models.dart';
      part 'generated.g.dart';
      int local() => 1;
    `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/models.dart",
        dedent`
      part of 'api.dart';
      class Model { int value = 1; }
      class _Private { int child = 1; }
    `,
      ),
      EvidenceTestSourceSnapshot.create(
        "src/generated.g.dart",
        "part of app.api; final generated = 1;",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/bridge.dart",
        "export 'external.dart';",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/external.dart",
        "class Exported { int value = 2; } final excluded = 1;",
      ),
      EvidenceTestSourceSnapshot.create(
        "other/independent.dart",
        "class Model {}",
      ),
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
